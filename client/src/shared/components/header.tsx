import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { app } from "../../config";
import logo from "../../assets/logo.png";

export function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const companyName = app.companyName;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <nav className="px-6 md:px-12 py-2 max-w-7xl mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3 group"
          onClick={() => setOpen(false)}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition">
            <svg className="w-10 h-10 rounded-xl">
              <image href={logo} className="w-10 h-10" />
            </svg>
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-gray-900">
            {companyName}
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-10">
          <NavLinks pathname={pathname} />
        </div>

        <button
          onClick={() => setOpen((p) => !p)}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
          aria-label="Toggle menu"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </nav>

      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 py-6 bg-white border-t flex flex-col gap-5">
          <NavLinks pathname={pathname} onClick={() => setOpen(false)} mobile />
        </div>
      </div>
    </header>
  );
}

type NavLinksProps = {
  onClick?: () => void;
  pathname: string;
  mobile?: boolean;
};

function NavLinks({ onClick, pathname, mobile }: NavLinksProps) {
  const base =
    "font-medium transition-colors relative after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:bg-emerald-500 after:transition-all after:duration-300";

  const link = (path: string) =>
    `${base} ${
      pathname === path
        ? "text-emerald-600 after:w-full"
        : "text-gray-600 hover:text-emerald-600 after:w-0 hover:after:w-full"
    } ${mobile ? "text-lg" : ""}`;

  return (
    <>
      <Link to="/features" onClick={onClick} className={link("/features")}>
        Features
      </Link>
      <Link
        to="/how-it-works"
        onClick={onClick}
        className={link("/how-it-works")}
      >
        How it Works
      </Link>
      <Link to="/about" onClick={onClick} className={link("/about")}>
        About
      </Link>
      <Link to="/support" onClick={onClick} className={link("/support")}>
        Support Us
      </Link>
    </>
  );
}
