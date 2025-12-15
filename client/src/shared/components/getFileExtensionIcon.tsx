import {
  Archive,
  File,
  FileCode,
  FileText,
  Film,
  Image,
  Music,
} from "lucide-react";

export const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "svg",
      "webp",
      "bmp",
      "tiff",
      "ico",
      "heic",
      "heif",
    ].includes(ext)
  ) {
    return <Image className="w-5 h-5 text-emerald-600" />;
  }

  if (
    [
      "mp4",
      "avi",
      "mov",
      "mkv",
      "webm",
      "flv",
      "wmv",
      "m4v",
      "mpeg",
      "mpg",
    ].includes(ext)
  ) {
    return <Film className="w-5 h-5 text-emerald-600" />;
  }

  if (
    ["mp3", "wav", "flac", "ogg", "m4a", "aac", "wma", "opus"].includes(ext)
  ) {
    return <Music className="w-5 h-5 text-emerald-600" />;
  }

  if (
    [
      "zip",
      "rar",
      "7z",
      "tar",
      "gz",
      "tgz",
      "bz2",
      "xz",
      "lz",
      "lz4",
      "iso",
    ].includes(ext)
  ) {
    return <Archive className="w-5 h-5 text-emerald-600" />;
  }

  if (
    [
      "pdf",
      "doc",
      "docx",
      "txt",
      "md",
      "rtf",
      "odt",
      "xls",
      "xlsx",
      "csv",
      "ppt",
      "pptx",
      "ods",
      "odp",
    ].includes(ext)
  ) {
    return <FileText className="w-5 h-5 text-emerald-600" />;
  }

  if (
    [
      "js",
      "ts",
      "tsx",
      "jsx",
      "json",
      "html",
      "css",
      "scss",
      "sass",
      "yml",
      "yaml",
      "xml",
      "py",
      "java",
      "c",
      "cpp",
      "cs",
      "go",
      "rs",
      "sh",
      "bat",
      "php",
      "rb",
      "sql",
      "env",
    ].includes(ext)
  ) {
    return <FileCode className="w-5 h-5 text-emerald-600" />;
  }

  return <File className="w-5 h-5 text-emerald-600" />;
};
