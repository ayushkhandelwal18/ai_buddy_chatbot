import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MdArrowForward, MdClose, MdMenu } from "react-icons/md";
import { useAuth } from "../context/AuthContent";
import Brand from "./public/Brand";

const links = [{ href: "/#features", label: "Features" }, { href: "/#how-it-works", label: "How it works" }, { href: "/#rag-technology", label: "RAG technology" }];

export default function Header() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const header = useRef(null);
  const toggle = useRef(null);
  const menu = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    menu.current?.querySelector("a")?.focus();
    const outside = (event) => { if (!header.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const actions = <>{auth?.isLoggedIn ? <Link to="/chat" className="public-btn public-btn-primary">Open workspace<MdArrowForward /></Link> : <><Link to="/login" className="nav-login">Log in</Link><Link to="/signup" className="public-btn public-btn-primary">Get started<MdArrowForward /></Link></>}</>;
  return <header className="public-header" ref={header}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="public-container nav-inner"><Brand /><nav className="desktop-nav" aria-label="Main navigation">{links.map(({ href, label }) => <a key={href} href={href}>{label}</a>)}</nav><div className="nav-actions">{actions}</div>
      <button ref={toggle} type="button" className="mobile-menu-toggle" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((current) => !current)}>{open ? <MdClose /> : <MdMenu />}</button>
    </div>
    {open && <nav ref={menu} className="mobile-navigation" id="mobile-navigation" aria-label="Mobile navigation" onClick={(event) => { if (event.target.closest("a")) setOpen(false); }}>{links.map(({ href, label }) => <a key={href} href={href}>{label}<MdArrowForward aria-hidden="true" /></a>)}<div className="mobile-nav-actions">{actions}</div></nav>}
  </header>;
}
