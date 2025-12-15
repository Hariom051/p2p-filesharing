import { Heart } from "lucide-react";
import { app } from "../../config";

export function Footer() {
  const year = new Date().getFullYear();
  const companyName = app.companyName;

  return (
    <footer className=" border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <p className="text-gray-600 text-sm">
            Copyright © {year}{" "}
            <span className="font-semibold text-gray-800">{companyName}</span>.
            Privacy-first file sharing for everyone.
          </p>

          <p className="text-gray-500 text-sm flex items-center gap-1">
            Built with <Heart className="w-4 h-4 text-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
}
