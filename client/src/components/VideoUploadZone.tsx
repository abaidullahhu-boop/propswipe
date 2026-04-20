import { useCallback, useState } from "react";
import { Upload, FileVideo } from "lucide-react";

interface VideoUploadZoneProps {
  onVideoSelect: (file: File) => void;
}

export function VideoUploadZone({ onVideoSelect }: VideoUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const videoFile = files.find((file) => file.type.startsWith("video/"));
      
      if (videoFile) {
        setSelectedFile(videoFile);
        onVideoSelect(videoFile);
      }
    },
    [onVideoSelect]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onVideoSelect(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl p-12 transition-all ${
        isDragging
          ? "border-accent bg-accent/10"
          : "border-border hover:border-accent/50"
      }`}
      data-testid="video-upload-zone"
    >
      <input
        type="file"
        accept="video/*"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        data-testid="input-video-file"
      />
      
      <div className="flex flex-col items-center gap-4 pointer-events-none">
        {selectedFile ? (
          <>
            <div className="bg-accent/20 p-6 rounded-2xl">
              <FileVideo className="w-16 h-16 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold" data-testid="text-filename">
                {selectedFile.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-muted p-6 rounded-2xl">
              <Upload className="w-16 h-16 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">
                Drag and drop your video here
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                or click to browse • MP4, MOV up to 200MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
