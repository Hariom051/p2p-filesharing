import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Send,
  Shield,
  Zap,
  Users,
  X,
  Copy,
  Loader2,
  Check,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { app } from "../config";
import { getFileIcon } from "../shared/components/getFileExtensionIcon";

type ProgressMap = Record<number, number>; // 0–100

export default function Sender() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const roomIdRef = useRef<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState<boolean>(false);

  const filesRef = useRef<File[]>([]);

  // Track upload progress for each file
  const [uploadProgress, setUploadProgress] = useState<ProgressMap>({});

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!shareUrl) return;
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shareUrl]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const validFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.();

        if (entry && entry.isDirectory) {
          console.warn("Folder drop is not allowed");
          return;
        }

        const file = item.getAsFile();
        if (file) validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setFiles((prev: File[]) => [...prev, ...validFiles]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList) return;

    const selectedFiles = Array.from(filesList);
    setFiles((prev: File[]) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  const createPeerConnection = (): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: app.iceServers,
    });

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("candidate", {
          room: roomIdRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      // console.log("Connection state:", pc.connectionState);
    };

    const dataChannel = pc.createDataChannel("fileTransfer", {
      ordered: true,
    });

    dataChannelRef.current = dataChannel;

    dataChannel.onopen = () => {
      // console.log("Data channel opened - ready to send files");
    };

    dataChannel.onmessage = async (event: MessageEvent) => {
      const message = JSON.parse(event.data as string);
      if (message.type === "request-download") {
        await sendFile(message.fileIndex);
      }
    };

    pcRef.current = pc;
    return pc;
  };

  const sendFile = async (fileIndex: number): Promise<void> => {
    const file = filesRef.current[fileIndex];
    const channel = dataChannelRef.current;

    if (!file || !channel) return;

    const chunkSize = 16384;
    let offset = 0;

    // Initialize progress for this file
    setUploadProgress((prev) => ({ ...prev, [fileIndex]: 0 }));

    channel.send(
      JSON.stringify({
        type: "file-start",
        fileIndex,
        name: file.name,
        size: file.size,
      })
    );

    while (offset < file.size) {
      if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
        await new Promise<void>((resolve) => {
          channel.addEventListener("bufferedamountlow", () => resolve(), {
            once: true,
          });
        });
      }

      const slice = file.slice(offset, offset + chunkSize);
      const chunk = await slice.arrayBuffer();

      channel.send(chunk);
      offset += chunk.byteLength;

      // Update progress
      const percent = Math.min(100, Math.round((offset / file.size) * 100));
      setUploadProgress((prev) => ({ ...prev, [fileIndex]: percent }));
    }

    channel.send(
      JSON.stringify({
        type: "file-end",
        fileIndex,
      })
    );

    // Mark as complete
    setUploadProgress((prev) => ({ ...prev, [fileIndex]: 100 }));

    // console.log(`File ${file.name} sent successfully`);
  };

  const connectSocket = (): void => {
    if (socketRef.current) socketRef.current.disconnect();

    const socket: Socket = io(app.websocketUrl, {
      transports: ["websocket"],
      reconnection: false,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // console.log("Socket connected:", socket.id); after connect we will send filesmeta data
      const filesMetadata = files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }));

      if (socket.connected) {
        socket.emit("create-room", {
          files: filesMetadata,
        });
      }
    });

    socket.on("connect_error", (error) => {
      toast.error(error?.message ?? "Websocket connection error");
      setIsGeneratingLink(false);
    });

    socket.on("room-created", ({ roomId: newRoomId }: { roomId: string }) => {
      roomIdRef.current = newRoomId;
      setShareUrl(`${window.location.origin}/receive/${newRoomId}`);
      setIsGeneratingLink(false);
    });

    socket.on("receiver-joined", async () => {
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("offer", {
        room: roomIdRef.current,
        sdp: pc.localDescription,
      });
    });

    socket.on("answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(sdp);
      }
    });

    socket.on(
      "candidate",
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        if (pcRef.current) {
          await pcRef.current.addIceCandidate(candidate);
        }
      }
    );
  };

  const generateShareLink = () => {
    setIsGeneratingLink(true);
    filesRef.current = files;
    connectSocket();
  };

  const copyToClipboard = (): void => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Copied");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const getTotalSize = (): number =>
    files.reduce((total, file) => total + file.size, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <main className="flex-1 px-6 md:px-12 py-20 md:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-gray-800">
              Share Files
              <span className="block text-emerald-600">
                Instantly & Securely
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-8">
              Peer-to-peer file transfer with end-to-end encryption. No servers,
              no limits, just pure speed.
            </p>
          </div>

          <div className="max-w-3xl mx-auto mb-16">
            <div
              className={`bg-white rounded-3xl p-8 md:p-12 border-2 border-dashed transition-all shadow-lg ${
                isDragging
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-gray-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {files.length === 0 ? (
                <div className="text-center">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Upload className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-gray-800">
                    Drop your files here
                  </h3>
                  <p className="text-gray-600 mb-6">or click to browse</p>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-emerald-700 transition shadow-md hover:shadow-lg">
                      <Upload className="w-5 h-5" />
                      Select Files
                    </span>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>

                  <p className="text-sm text-gray-500 mt-4">
                    Any file type • No size limit • Multiple files supported
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-semibold text-gray-800">
                          {files.length} {files.length === 1 ? "File" : "Files"}{" "}
                          Selected
                        </h3>
                        <p className="text-gray-600">
                          Total size: {formatFileSize(getTotalSize())}
                        </p>
                      </div>
                      {!shareUrl && (
                        <label
                          htmlFor="file-upload-more"
                          className="cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition text-sm">
                            <Upload className="w-4 h-4" />
                            Add More
                          </span>
                          <input
                            id="file-upload-more"
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </label>
                      )}
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
                      {files.map((file, index) => {
                        const fileProgress = uploadProgress[index];
                        const isComplete = fileProgress === 100;

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                {isComplete ? (
                                  <Check className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  getFileIcon(file.name)
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-800 truncate">
                                  {file.name}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-500">
                                    {formatFileSize(file.size)}
                                  </p>
                                  {fileProgress !== undefined && (
                                    <>
                                      <span className="text-gray-400">•</span>
                                      <p className="text-sm text-emerald-600">
                                        {isComplete
                                          ? "Sent"
                                          : `${fileProgress}%`}
                                      </p>
                                    </>
                                  )}
                                </div>

                                {/* Progress Bar */}
                                {fileProgress !== undefined && !isComplete && (
                                  <div className="mt-2 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                                      style={{ width: `${fileProgress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            {!shareUrl && (
                              <button
                                onClick={() => removeFile(index)}
                                disabled={isGeneratingLink}
                                className="ml-4 text-gray-400 hover:text-red-500 transition flex-shrink-0 cursor-pointer"
                                aria-label="Remove file"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!shareUrl ? (
                    <div className="flex gap-4 justify-center flex-wrap">
                      <button
                        disabled={isGeneratingLink}
                        onClick={generateShareLink}
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-emerald-700 transition shadow-md hover:shadow-lg cursor-pointer"
                      >
                        {isGeneratingLink ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Generate Share Link
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setFiles([])}
                        disabled={isGeneratingLink}
                        className={`inline-flex items-center gap-2 bg-gray-200 text-gray-700 px-8 py-4 rounded-full font-semibold hover:bg-gray-300 transition cursor-pointer
                        `}
                      >
                        Clear All Files
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">
                        Share this link
                      </h4>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={shareUrl}
                          readOnly
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg font-mono text-sm truncate"
                        />

                        <button
                          onClick={copyToClipboard}
                          className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                      </div>

                      <p className="text-sm text-gray-600 mt-3">
                        Keep this tab open to transfer files when the receiver
                        connects
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">
                End-to-End Encrypted
              </h3>
              <p className="text-gray-600">
                Your files are encrypted on your device. Only the recipient can
                decrypt them.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition">
              <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-7 h-7 text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">
                Lightning Fast
              </h3>
              <p className="text-gray-600">
                Direct peer-to-peer connection means maximum transfer speed.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition">
              <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-cyan-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">
                No Registration
              </h3>
              <p className="text-gray-600">
                Start sharing immediately. No accounts, no tracking, no hassle.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
