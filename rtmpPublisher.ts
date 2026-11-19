import net from 'net';
import tls from 'tls';
import dns from 'dns';
import crypto from 'crypto';

// ==================== AMF0 ENCODING / DECODING HELPERS ====================

function amf0String(str: string): Buffer {
  const bytes = Buffer.from(str, 'utf8');
  const out = Buffer.alloc(3 + bytes.length);
  out[0] = 0x02;
  out.writeUInt16BE(bytes.length, 1);
  bytes.copy(out, 3);
  return out;
}

function amf0Number(num: number): Buffer {
  const out = Buffer.alloc(9);
  out[0] = 0x00;
  out.writeDoubleBE(num, 1);
  return out;
}

function amf0Null(): Buffer {
  return Buffer.from([0x05]);
}

function amf0Object(obj: Record<string, string | number | boolean | null>): Buffer {
  const parts: Buffer[] = [Buffer.from([0x03])];
  for (const [key, val] of Object.entries(obj)) {
    const keyBytes = Buffer.from(key, 'utf8');
    const keyLen = Buffer.alloc(2);
    keyLen.writeUInt16BE(keyBytes.length, 0);
    parts.push(keyLen, keyBytes);
    if (typeof val === 'string') {
      parts.push(amf0String(val));
    } else if (typeof val === 'number') {
      parts.push(amf0Number(val));
    } else if (typeof val === 'boolean') {
      parts.push(Buffer.from([0x01, val ? 1 : 0]));
    } else {
      parts.push(amf0Null());
    }
  }
  parts.push(Buffer.from([0x00, 0x00, 0x09]));
  return Buffer.concat(parts);
}

interface DecodedAmf0Command {
  name: string;
  txId: number;
  fourthNumber: number | null;
  ascii: string;
}

function decodeAmf0Command(buf: Buffer): DecodedAmf0Command {
  let pos = 0;
  let name = '';
  let txId = -1;
  let fourthNumber: number | null = null;

  if (pos + 3 <= buf.length && buf[pos] === 0x02) {
    const len = buf.readUInt16BE(pos + 1);
    if (pos + 3 + len <= buf.length) {
      name = buf.subarray(pos + 3, pos + 3 + len).toString('utf8');
      pos += 3 + len;
    }
  }
  if (pos + 9 <= buf.length && buf[pos] === 0x00) {
    txId = buf.readDoubleBE(pos + 1);
    pos += 9;
  }
  if (pos < buf.length && buf[pos] === 0x05) {
    pos += 1;
    if (pos + 9 <= buf.length && buf[pos] === 0x00) {
      fourthNumber = buf.readDoubleBE(pos + 1);
    }
  }
  const ascii = buf.toString('latin1').replace(/[^ -~]/g, '.');
  return { name, txId, fourthNumber, ascii };
}

// ==================== RTMP CHUNK SERIALIZER & PARSER ====================

function buildRtmpMessage(
  csid: number,
  timestamp: number,
  msgTypeId: number,
  msgStreamId: number,
  payload: Buffer,
  outChunkSize: number
): Buffer {
  const totalLen = payload.length;
  const ts = timestamp >>> 0;
  const useExtTs = ts >= 0xffffff;
  const tsField = useExtTs ? 0xffffff : ts;

  const chunks: Buffer[] = [];
  let offset = 0;
  let first = true;

  while (offset < totalLen || (totalLen === 0 && first)) {
    const sliceLen = Math.min(outChunkSize, totalLen - offset);
    if (first) {
      const hdr = Buffer.alloc(useExtTs ? 16 : 12);
      hdr[0] = (0 << 6) | (csid & 0x3f); // fmt 0
      hdr[1] = (tsField >> 16) & 0xff;
      hdr[2] = (tsField >> 8) & 0xff;
      hdr[3] = tsField & 0xff;
      hdr[4] = (totalLen >> 16) & 0xff;
      hdr[5] = (totalLen >> 8) & 0xff;
      hdr[6] = totalLen & 0xff;
      hdr[7] = msgTypeId;
      hdr.writeUInt32LE(msgStreamId >>> 0, 8);
      if (useExtTs) {
        hdr.writeUInt32BE(ts, 12);
      }
      chunks.push(hdr);
      first = false;
    } else {
      const hdr = Buffer.alloc(useExtTs ? 5 : 1);
      hdr[0] = (3 << 6) | (csid & 0x3f); // fmt 3 continuation
      if (useExtTs) {
        hdr.writeUInt32BE(ts, 1);
      }
      chunks.push(hdr);
    }

    if (sliceLen > 0) {
      chunks.push(payload.subarray(offset, offset + sliceLen));
      offset += sliceLen;
    }
  }

  return chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
}

interface IncomingRtmpMessage {
  csid: number;
  timestamp: number;
  msgTypeId: number;
  msgStreamId: number;
  payload: Buffer;
}

interface ChunkStreamState {
  timestamp: number;
  tsDelta: number;
  msgLen: number;
  msgTypeId: number;
  msgStreamId: number;
  extTs: boolean;
  chunks: Buffer[];
  bytesRead: number;
}

class RtmpIncomingParser {
  private inChunkSize = 128;
  private buf: Buffer = Buffer.alloc(0);
  private streams = new Map<number, ChunkStreamState>();
  private onMessage: (msg: IncomingRtmpMessage) => void;

  constructor(onMessage: (msg: IncomingRtmpMessage) => void) {
    this.onMessage = onMessage;
  }

  push(data: Buffer) {
    this.buf = this.buf.length === 0 ? data : Buffer.concat([this.buf, data]);

    while (this.buf.length > 0) {
      let pos = 0;
      const b0 = this.buf[pos++];
      const fmt = (b0 >> 6) & 0x03;
      let csid = b0 & 0x3f;

      if (csid === 0) {
        if (this.buf.length < pos + 1) return;
        csid = this.buf[pos++] + 64;
      } else if (csid === 1) {
        if (this.buf.length < pos + 2) return;
        csid = this.buf[pos] + this.buf[pos + 1] * 256 + 64;
        pos += 2;
      }

      let st = this.streams.get(csid);
      if (!st) {
        st = {
          timestamp: 0,
          tsDelta: 0,
          msgLen: 0,
          msgTypeId: 0,
          msgStreamId: 0,
          extTs: false,
          chunks: [],
          bytesRead: 0,
        };
        this.streams.set(csid, st);
      }

      const hdrLens = [11, 7, 3, 0];
      const needHdr = hdrLens[fmt];
      if (this.buf.length < pos + needHdr) return;

      let rawTs = 0;
      if (fmt === 0) {
        rawTs = (this.buf[pos] << 16) | (this.buf[pos + 1] << 8) | this.buf[pos + 2];
        st.msgLen = (this.buf[pos + 3] << 16) | (this.buf[pos + 4] << 8) | this.buf[pos + 5];
        st.msgTypeId = this.buf[pos + 6];
        st.msgStreamId = this.buf.readUInt32LE(pos + 7);
        pos += 11;
        st.extTs = rawTs === 0xffffff;
        if (!st.extTs) st.timestamp = rawTs;
      } else if (fmt === 1) {
        rawTs = (this.buf[pos] << 16) | (this.buf[pos + 1] << 8) | this.buf[pos + 2];
        st.msgLen = (this.buf[pos + 3] << 16) | (this.buf[pos + 4] << 8) | this.buf[pos + 5];
        st.msgTypeId = this.buf[pos + 6];
        pos += 7;
        st.extTs = rawTs === 0xffffff;
        if (!st.extTs) st.tsDelta = rawTs;
      } else if (fmt === 2) {
        rawTs = (this.buf[pos] << 16) | (this.buf[pos + 1] << 8) | this.buf[pos + 2];
        pos += 3;
        st.extTs = rawTs === 0xffffff;
        if (!st.extTs) st.tsDelta = rawTs;
      }

      if (st.extTs) {
        if (this.buf.length < pos + 4) return;
        const ext = this.buf.readUInt32BE(pos);
        pos += 4;
        if (fmt === 0) st.timestamp = ext;
        else st.tsDelta = ext;
      }

      if (st.msgLen > 16 * 1024 * 1024) {
        // Corrupt stream safeguard
        this.buf = Buffer.alloc(0);
        return;
      }

      const remaining = Math.max(0, st.msgLen - st.bytesRead);
      const toRead = Math.min(this.inChunkSize, remaining);
      if (this.buf.length < pos + toRead) return;

      const slice = this.buf.subarray(pos, pos + toRead);
      this.buf = this.buf.subarray(pos + toRead);

      if (toRead > 0) {
        st.chunks.push(Buffer.from(slice));
        st.bytesRead += toRead;
      }

      if (st.bytesRead >= st.msgLen) {
        const fullPayload = st.chunks.length === 1 ? st.chunks[0] : Buffer.concat(st.chunks);
        st.chunks = [];
        st.bytesRead = 0;

        if (st.msgTypeId === 1 && fullPayload.length >= 4) {
          const newSize = fullPayload.readUInt32BE(0) & 0x7fffffff;
          if (newSize >= 1 && newSize <= 16777215) {
            this.inChunkSize = newSize;
          }
        }

        this.onMessage({
          csid,
          timestamp: st.timestamp,
          msgTypeId: st.msgTypeId,
          msgStreamId: st.msgStreamId,
          payload: fullPayload,
        });
      }
    }
  }
}

// ==================== FLV TAG & MULTI-DESTINATION FANOUT HUB ====================

export interface FlvTag {
  tagType: number; // 8 = audio, 9 = video, 18 = scriptData/onMetaData
  timestamp: number; // Monotonic milliseconds
  payload: Buffer;
  isVideoSeqHeader: boolean;
  isAudioSeqHeader: boolean;
  isVideoKeyframe: boolean;
}

export class FlvPipeHub {
  private buf: Buffer = Buffer.alloc(0);
  private headerSkipped = false;
  private publishers = new Set<NativeRtmpPublisher>();

  public metaTag: Buffer | null = null;
  public avcSeqHeader: Buffer | null = null;
  public aacSeqHeader: Buffer | null = null;

  private tsOffset = 0;
  private lastRawTs = 0;
  private highWaterTs = 0;

  public totalVideoFrames = 0;
  public totalBytes = 0;
  private lastRateCheckTime = Date.now();
  private bytesSinceRateCheck = 0;
  public currentBitrateKbps = 0;

  private onStats?: (videoFrames: number, bitrateKbps: number) => void;

  constructor(onStats?: (videoFrames: number, bitrateKbps: number) => void) {
    this.onStats = onStats;
  }

  addPublisher(pub: NativeRtmpPublisher) {
    this.publishers.add(pub);
  }

  removePublisher(pub: NativeRtmpPublisher) {
    this.publishers.delete(pub);
  }

  /** Call when restarting the underlying FFmpeg process so timestamps continue smoothly */
  resetForNewFlvStream() {
    this.buf = Buffer.alloc(0);
    this.headerSkipped = false;
    this.tsOffset = this.highWaterTs + 33;
    this.lastRawTs = 0;
  }

  pushFlvData(chunk: Buffer) {
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk]);
    this.totalBytes += chunk.length;
    this.bytesSinceRateCheck += chunk.length;

    const now = Date.now();
    const elapsedMs = now - this.lastRateCheckTime;
    if (elapsedMs >= 1000) {
      this.currentBitrateKbps = Math.round((this.bytesSinceRateCheck * 8) / elapsedMs);
      this.bytesSinceRateCheck = 0;
      this.lastRateCheckTime = now;
      this.onStats?.(this.totalVideoFrames, this.currentBitrateKbps);
    }

    if (!this.headerSkipped) {
      if (this.buf.length < 13) return;
      // Validate 'FLV' signature
      if (this.buf[0] !== 0x46 || this.buf[1] !== 0x4c || this.buf[2] !== 0x56) {
        const idx = this.buf.indexOf(Buffer.from([0x46, 0x4c, 0x56, 0x01]));
        if (idx === -1) {
          this.buf = Buffer.alloc(0);
          return;
        }
        this.buf = this.buf.subarray(idx);
        if (this.buf.length < 13) return;
      }
      const headerSize = this.buf.readUInt32BE(5);
      if (this.buf.length < headerSize + 4) return;
      this.buf = this.buf.subarray(headerSize + 4);
      this.headerSkipped = true;
    }

    while (this.buf.length >= 11) {
      const tagType = this.buf[0] & 0x1f;
      const dataSize = (this.buf[1] << 16) | (this.buf[2] << 8) | this.buf[3];
      if (this.buf.length < 11 + dataSize + 4) break;

      const rawTs =
        ((this.buf[7] << 24) | (this.buf[4] << 16) | (this.buf[5] << 8) | this.buf[6]) >>> 0;
      const payload = Buffer.from(this.buf.subarray(11, 11 + dataSize));
      this.buf = this.buf.subarray(11 + dataSize + 4);

      if (payload.length === 0) continue;

      const isVideoSeqHeader =
        tagType === 9 && payload.length >= 2 && (payload[0] & 0x0f) === 7 && payload[1] === 0;
      const isAudioSeqHeader =
        tagType === 8 &&
        payload.length >= 2 &&
        ((payload[0] >> 4) & 0x0f) === 10 &&
        payload[1] === 0;
      const isVideoKeyframe = tagType === 9 && ((payload[0] >> 4) & 0x0f) === 1;

      if (tagType === 18) {
        this.metaTag = payload;
      } else if (isVideoSeqHeader) {
        this.avcSeqHeader = payload;
      } else if (isAudioSeqHeader) {
        this.aacSeqHeader = payload;
      }

      // Maintain monotonic timestamps across loop boundaries (-stream_loop -1)
      let adjustedTs = rawTs + this.tsOffset;
      if (!isVideoSeqHeader && !isAudioSeqHeader && tagType !== 18) {
        if (rawTs + 500 < this.lastRawTs) {
          this.tsOffset = this.highWaterTs + 33 - rawTs;
          adjustedTs = rawTs + this.tsOffset;
        }
        this.lastRawTs = rawTs;
        if (adjustedTs > this.highWaterTs) {
          this.highWaterTs = adjustedTs;
        }
      }

      if (tagType === 9 && !isVideoSeqHeader) {
        this.totalVideoFrames += 1;
      }

      const tag: FlvTag = {
        tagType,
        timestamp: adjustedTs >>> 0,
        payload,
        isVideoSeqHeader,
        isAudioSeqHeader,
        isVideoKeyframe,
      };

      for (const pub of this.publishers) {
        pub.sendFlvTag(tag);
      }
    }
  }
}

// ==================== PURE NODE.JS NATIVE RTMPS/RTMP PUBLISHER ====================

export interface RtmpPublisherCallbacks {
  onStatus?: (status: 'connecting' | 'streaming' | 'reconnecting' | 'error', detail: string) => void;
  onFrameSent?: () => void;
}

export class NativeRtmpPublisher {
  private hub: FlvPipeHub;
  private label: string;
  private getUrls: (attempt: number) => string;
  private callbacks: RtmpPublisherCallbacks;

  private stopped = false;
  private attempt = 0;
  private socket: net.Socket | tls.TLSSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private publishConfirmTimer: ReturnType<typeof setTimeout> | null = null;

  private state: 'idle' | 'handshake' | 'connecting' | 'creating' | 'publishing' | 'streaming' =
    'idle';
  private streamId = 1;
  private outChunkSize = 4096;
  private serverWindowAckSize = 2500000;
  private bytesReceived = 0;
  private lastAckSent = 0;

  private headersSent = false;
  private awaitingKeyframe = true;
  private baseTs: number | null = null;
  public framesPublished = 0;
  public lastDiagnostic = '';

  constructor(
    hub: FlvPipeHub,
    label: string,
    getUrls: (attempt: number) => string,
    callbacks: RtmpPublisherCallbacks = {}
  ) {
    this.hub = hub;
    this.label = label;
    this.getUrls = getUrls;
    this.callbacks = callbacks;
  }

  start() {
    this.stopped = false;
    this.hub.addPublisher(this);
    void this.connectOnce();
  }

  stop() {
    this.stopped = true;
    this.hub.removePublisher(this);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
  }

  private cleanupSocket() {
    if (this.publishConfirmTimer) {
      clearTimeout(this.publishConfirmTimer);
      this.publishConfirmTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.destroy();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.state = 'idle';
    this.headersSent = false;
    this.awaitingKeyframe = true;
    this.baseTs = null;
  }

  private scheduleReconnect(reason: string, isKeyRejection = false) {
    if (this.stopped) return;
    this.cleanupSocket();
    this.lastDiagnostic = reason;
    this.attempt += 1;

    if (isKeyRejection) {
      this.callbacks.onStatus?.('error', reason);
    } else if (this.attempt <= 2) {
      this.callbacks.onStatus?.('reconnecting', reason);
    } else {
      this.callbacks.onStatus?.('error', reason);
    }

    const delayMs = this.attempt <= 2 ? 1200 : 2500;
    this.reconnectTimer = setTimeout(() => {
      void this.connectOnce();
    }, delayMs);
  }

  private async connectOnce() {
    if (this.stopped) return;
    this.cleanupSocket();

    const fullUrl = this.getUrls(this.attempt);
    let parsed: URL;
    try {
      parsed = new URL(fullUrl);
    } catch {
      this.scheduleReconnect(`Invalid RTMP URL for ${this.label}`);
      return;
    }

    const isTls = parsed.protocol === 'rtmps:';
    const remoteHost = parsed.hostname;
    const remotePort = parsed.port ? Number(parsed.port) : isTls ? 443 : 1935;
    const cleanPath = parsed.pathname.replace(/^\/+/, '');
    const slashIdx = cleanPath.indexOf('/');
    const appName = slashIdx >= 0 ? cleanPath.slice(0, slashIdx) : cleanPath || 'live2';
    const streamKey =
      (slashIdx >= 0 ? cleanPath.slice(slashIdx + 1) : '') + (parsed.search || '');
    const tcUrl = `${parsed.protocol}//${remoteHost}:${remotePort}/${appName}`;

    this.callbacks.onStatus?.(
      'connecting',
      `[${this.label}] Connecting to ${remoteHost}:${remotePort}...`
    );

    // Resolve IPv4 in Node.js (avoids IPv6 blackholes on shared hosting)
    let connectHost = remoteHost;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(remoteHost)) {
      try {
        const res = await dns.promises.lookup(remoteHost, { family: 4 });
        if (res?.address) connectHost = res.address;
      } catch {
        try {
          const addrs = await dns.promises.resolve4(remoteHost);
          if (addrs && addrs.length > 0) connectHost = addrs[0];
        } catch (dnsErr) {
          this.scheduleReconnect(
            `DNS lookup failed for ${remoteHost}: ${
              dnsErr instanceof Error ? dnsErr.message : String(dnsErr)
            }`
          );
          return;
        }
      }
    }

    if (this.stopped) return;

    const sock = isTls
      ? tls.connect({
          host: connectHost,
          port: remotePort,
          servername: remoteHost,
          rejectUnauthorized: false,
        })
      : net.connect({
          host: connectHost,
          port: remotePort,
        });

    this.socket = sock;
    sock.setNoDelay(true);
    sock.setTimeout(15000);

    let hsBuf: Buffer = Buffer.alloc(0);
    let handshakeDone = false;
    let settled = false;
    this.bytesReceived = 0;
    this.lastAckSent = 0;
    this.state = 'handshake';

    const failOnce = (msg: string, isKeyRejection = false) => {
      if (settled || this.stopped) return;
      settled = true;
      this.scheduleReconnect(msg, isKeyRejection);
    };

    const promoteToStreaming = () => {
      if (this.stopped || this.state === 'streaming' || !this.socket || this.socket.destroyed) {
        return;
      }
      if (this.publishConfirmTimer) {
        clearTimeout(this.publishConfirmTimer);
        this.publishConfirmTimer = null;
      }
      this.state = 'streaming';
      this.headersSent = false;
      this.awaitingKeyframe = true;
      this.baseTs = null;
      this.attempt = 0;
      this.lastDiagnostic = `Connected to ${remoteHost}:${remotePort}`;
      this.callbacks.onStatus?.(
        'streaming',
        `[${this.label}] LIVE connected to ${remoteHost}:${remotePort}`
      );
      this.flushSequenceHeaders();
    };

    const parser = new RtmpIncomingParser((msg) => {
      if (this.stopped || !this.socket || this.socket.destroyed) return;

      // Window Acknowledgement Size (type 5)
      if (msg.msgTypeId === 5 && msg.payload.length >= 4) {
        this.serverWindowAckSize = msg.payload.readUInt32BE(0);
        return;
      }

      // User Control Message (type 4) — Respond to PingRequest (event 6) with PingResponse (event 7)
      if (msg.msgTypeId === 4 && msg.payload.length >= 6) {
        const eventType = msg.payload.readUInt16BE(0);
        if (eventType === 6) {
          const pong = Buffer.alloc(6);
          pong.writeUInt16BE(7, 0);
          msg.payload.copy(pong, 2, 2, 6);
          this.safeWrite(buildRtmpMessage(2, 0, 4, 0, pong, this.outChunkSize));
        }
        return;
      }

      // AMF0 Command (type 20)
      if (msg.msgTypeId === 20) {
        const cmd = decodeAmf0Command(msg.payload);

        if (this.state === 'connecting' && cmd.name === '_result' && cmd.txId === 1) {
          if (cmd.ascii.includes('NetConnection.Connect.Success')) {
            this.state = 'creating';
            // Send releaseStream (tx 2), FCPublish (tx 3), createStream (tx 4)
            this.safeWrite(
              buildRtmpMessage(
                3,
                0,
                20,
                0,
                Buffer.concat([
                  amf0String('releaseStream'),
                  amf0Number(2),
                  amf0Null(),
                  amf0String(streamKey),
                ]),
                this.outChunkSize
              )
            );
            this.safeWrite(
              buildRtmpMessage(
                3,
                0,
                20,
                0,
                Buffer.concat([
                  amf0String('FCPublish'),
                  amf0Number(3),
                  amf0Null(),
                  amf0String(streamKey),
                ]),
                this.outChunkSize
              )
            );
            this.safeWrite(
              buildRtmpMessage(
                3,
                0,
                20,
                0,
                Buffer.concat([amf0String('createStream'), amf0Number(4), amf0Null()]),
                this.outChunkSize
              )
            );
          } else {
            failOnce(`${this.label} rejected RTMP connect (${remoteHost}).`, true);
          }
          return;
        }

        if (cmd.name === '_error') {
          failOnce(
            `${this.label} rejected stream key (${cmd.ascii.slice(0, 90)}). Check your Stream Key.`,
            true
          );
          return;
        }

        if (this.state === 'creating' && cmd.name === '_result' && cmd.txId === 4) {
          this.streamId = cmd.fourthNumber && cmd.fourthNumber >= 1 ? Math.floor(cmd.fourthNumber) : 1;
          this.state = 'publishing';
          this.safeWrite(
            buildRtmpMessage(
              8,
              0,
              20,
              this.streamId,
              Buffer.concat([
                amf0String('publish'),
                amf0Number(5),
                amf0Null(),
                amf0String(streamKey),
                amf0String('live'),
              ]),
              this.outChunkSize
            )
          );
          // Some RTMP servers do not send an explicit onStatus after publish; promote after 700ms if socket remains open
          this.publishConfirmTimer = setTimeout(() => {
            if (this.state === 'publishing') {
              promoteToStreaming();
            }
          }, 700);
          return;
        }

        if (cmd.name === 'onStatus' || cmd.name === 'onFCPublish') {
          if (cmd.ascii.includes('NetStream.Publish.Start')) {
            promoteToStreaming();
          } else if (
            cmd.ascii.includes('BadName') ||
            cmd.ascii.includes('Failed') ||
            cmd.ascii.includes('Unauthorized') ||
            cmd.ascii.includes('Rejected')
          ) {
            const codeMatch = cmd.ascii.match(/NetStream\.[A-Za-z0-9_.]+/);
            const cleanCode = codeMatch ? codeMatch[0] : 'NetStream.Publish.Rejected';
            failOnce(
              `${this.label} rejected Stream Key (${cleanCode}). Please verify your Stream Key in ${this.label} Studio.`,
              true
            );
          }
        }
      }
    });

    const onConnected = () => {
      if (this.stopped || sock.destroyed) return;
      // Send RTMP C0 (0x03) + C1 (1536 bytes)
      const c0c1 = Buffer.alloc(1537);
      c0c1[0] = 0x03;
      c0c1.writeUInt32BE(0, 1);
      c0c1.writeUInt32BE(0, 5);
      crypto.randomBytes(1528).copy(c0c1, 9);
      this.safeWrite(c0c1);
    };

    if (isTls) {
      sock.once('secureConnect', onConnected);
    } else {
      sock.once('connect', onConnected);
    }

    sock.on('data', (chunk: Buffer) => {
      if (this.stopped) return;
      this.bytesReceived += chunk.length;

      if (
        handshakeDone &&
        this.serverWindowAckSize > 0 &&
        this.bytesReceived - this.lastAckSent >= this.serverWindowAckSize
      ) {
        this.lastAckSent = this.bytesReceived;
        const ackPayload = Buffer.alloc(4);
        ackPayload.writeUInt32BE(this.bytesReceived >>> 0, 0);
        this.safeWrite(buildRtmpMessage(2, 0, 3, 0, ackPayload, this.outChunkSize));
      }

      if (!handshakeDone) {
        hsBuf = hsBuf.length === 0 ? chunk : Buffer.concat([hsBuf, chunk]);
        if (hsBuf.length >= 3073) {
          const s1 = hsBuf.subarray(1, 1537);
          const remaining = hsBuf.subarray(3073);
          hsBuf = Buffer.alloc(0);
          handshakeDone = true;

          // Echo S1 as C2
          this.safeWrite(Buffer.from(s1));

          // Set outgoing chunk size to 4096 (using default 128-byte chunk size for this control msg)
          const csPayload = Buffer.alloc(4);
          csPayload.writeUInt32BE(this.outChunkSize, 0);
          this.safeWrite(buildRtmpMessage(2, 0, 1, 0, csPayload, 128));

          // Send Window Acknowledgement Size
          const winPayload = Buffer.alloc(4);
          winPayload.writeUInt32BE(2500000, 0);
          this.safeWrite(buildRtmpMessage(2, 0, 5, 0, winPayload, this.outChunkSize));

          // Send connect command (txId = 1)
          const connectPayload = Buffer.concat([
            amf0String('connect'),
            amf0Number(1),
            amf0Object({
              app: appName,
              type: 'nonprivate',
              flashVer: 'FMLE/3.0 (compatible; FMSc/1.0)',
              tcUrl,
            }),
          ]);
          this.safeWrite(buildRtmpMessage(3, 0, 20, 0, connectPayload, this.outChunkSize));
          this.state = 'connecting';

          if (remaining.length > 0) {
            parser.push(remaining);
          }
        }
      } else {
        parser.push(chunk);
      }
    });

    sock.on('timeout', () => {
      failOnce(`Connection timed out to ${remoteHost}:${remotePort} (${this.label}). Retrying...`);
    });

    sock.on('error', (err) => {
      failOnce(
        `Network error connecting to ${remoteHost}:${remotePort} (${this.label}): ${err.message}`
      );
    });

    sock.on('close', () => {
      if (this.state === 'publishing') {
        failOnce(
          `${this.label} server (${remoteHost}) closed connection right after publish — verify your ${this.label} Stream Key is valid & Live Studio is ready (auto-retrying).`,
          true
        );
      } else if (this.state === 'streaming') {
        failOnce(`${this.label} stream disconnected — auto-reconnecting...`);
      } else {
        failOnce(
          `${this.label} connection closed during ${this.state} (${remoteHost}:${remotePort}) — retrying...`
        );
      }
    });
  }

  private safeWrite(buf: Buffer): boolean {
    if (!this.socket || this.socket.destroyed || !this.socket.writable) return false;
    try {
      this.socket.write(buf);
      return true;
    } catch {
      return false;
    }
  }

  private flushSequenceHeaders() {
    if (this.state !== 'streaming' || this.headersSent) return;
    if (!this.hub.avcSeqHeader && !this.hub.aacSeqHeader) return;

    if (this.hub.metaTag) {
      const metaPayload = Buffer.concat([amf0String('@setDataFrame'), this.hub.metaTag]);
      this.safeWrite(buildRtmpMessage(4, 0, 18, this.streamId, metaPayload, this.outChunkSize));
    }
    if (this.hub.avcSeqHeader) {
      this.safeWrite(
        buildRtmpMessage(6, 0, 9, this.streamId, this.hub.avcSeqHeader, this.outChunkSize)
      );
    }
    if (this.hub.aacSeqHeader) {
      this.safeWrite(
        buildRtmpMessage(4, 0, 8, this.streamId, this.hub.aacSeqHeader, this.outChunkSize)
      );
    }
    this.headersSent = true;
  }

  sendFlvTag(tag: FlvTag) {
    if (this.stopped || this.state !== 'streaming' || !this.socket || this.socket.destroyed) {
      return;
    }

    if (tag.isVideoSeqHeader || tag.isAudioSeqHeader || tag.tagType === 18) {
      if (!this.headersSent) {
        this.flushSequenceHeaders();
      } else if (tag.isVideoSeqHeader) {
        this.safeWrite(buildRtmpMessage(6, 0, 9, this.streamId, tag.payload, this.outChunkSize));
      } else if (tag.isAudioSeqHeader) {
        this.safeWrite(buildRtmpMessage(4, 0, 8, this.streamId, tag.payload, this.outChunkSize));
      }
      return;
    }

    if (!this.headersSent) {
      this.flushSequenceHeaders();
    }

    // Start sending media on a clean H.264 keyframe so YouTube/Facebook decoder locks instantly
    if (this.awaitingKeyframe) {
      if (tag.tagType === 9 && tag.isVideoKeyframe) {
        this.awaitingKeyframe = false;
        this.baseTs = tag.timestamp;
      } else {
        return;
      }
    }

    // Backpressure guard: if network upload stalls (> 4 MB queued), drop non-keyframe video frames
    if (this.socket.writableLength > 4 * 1024 * 1024 && tag.tagType === 9 && !tag.isVideoKeyframe) {
      return;
    }

    const relTs = this.baseTs !== null ? Math.max(0, tag.timestamp - this.baseTs) : 0;

    if (tag.tagType === 9) {
      if (this.safeWrite(buildRtmpMessage(6, relTs, 9, this.streamId, tag.payload, this.outChunkSize))) {
        this.framesPublished += 1;
        this.callbacks.onFrameSent?.();
      }
    } else if (tag.tagType === 8) {
      this.safeWrite(buildRtmpMessage(4, relTs, 8, this.streamId, tag.payload, this.outChunkSize));
    }
  }
}

// ==================== DIAGNOSTIC PROBE FOR HOSTINGER ====================

export async function probeRtmpsEndpoint(
  host: string,
  port: number,
  app: string
): Promise<{ reachable: boolean; ip?: string; rtmpConnectSuccess: boolean; detail: string }> {
  try {
    const resolved = await dns.promises.lookup(host, { family: 4 });
    const ip = resolved.address;

    return await new Promise((resolve) => {
      const sock = tls.connect({
        host: ip,
        port,
        servername: host,
        rejectUnauthorized: false,
      });
      let done = false;
      const finish = (reachable: boolean, rtmpConnectSuccess: boolean, detail: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          sock.destroy();
        } catch {
          // ignore
        }
        resolve({ reachable, ip, rtmpConnectSuccess, detail });
      };

      const timer = setTimeout(() => finish(false, false, 'Timed out (3s)'), 3000);
      let hsBuf = Buffer.alloc(0);
      let handshakeDone = false;
      const parser = new RtmpIncomingParser((msg) => {
        if (msg.msgTypeId === 20) {
          const cmd = decodeAmf0Command(msg.payload);
          if (cmd.ascii.includes('NetConnection.Connect.Success')) {
            finish(true, true, 'TLS + RTMP NetConnection.Connect.Success');
          }
        }
      });

      sock.once('secureConnect', () => {
        const c0c1 = Buffer.alloc(1537);
        c0c1[0] = 0x03;
        crypto.randomBytes(1528).copy(c0c1, 9);
        sock.write(c0c1);
      });

      sock.on('data', (chunk: Buffer) => {
        if (!handshakeDone) {
          hsBuf = Buffer.concat([hsBuf, chunk]);
          if (hsBuf.length >= 3073) {
            const s1 = hsBuf.subarray(1, 1537);
            const rest = hsBuf.subarray(3073);
            handshakeDone = true;
            sock.write(s1);
            const connectPayload = Buffer.concat([
              amf0String('connect'),
              amf0Number(1),
              amf0Object({
                app,
                type: 'nonprivate',
                flashVer: 'FMLE/3.0 (compatible; FMSc/1.0)',
                tcUrl: `rtmps://${host}:${port}/${app}`,
              }),
            ]);
            sock.write(buildRtmpMessage(3, 0, 20, 0, connectPayload, 128));
            if (rest.length > 0) parser.push(rest);
          }
        } else {
          parser.push(chunk);
        }
      });

      sock.on('error', (err) => finish(false, false, err.message));
      sock.on('close', () => finish(false, false, 'Closed before NetConnection.Connect.Success'));
    });
  } catch (err) {
    return {
      reachable: false,
      rtmpConnectSuccess: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
