import { Link } from "react-router-dom";
import { MdAutoAwesome } from "react-icons/md";

export default function Brand({ inverse = false }) {
  return <Link to="/" className={`public-brand${inverse ? " public-brand--inverse" : ""}`} aria-label="AI-Buddy home">
    <span className="public-brand-mark" aria-hidden="true"><MdAutoAwesome /></span>
    <span>AI<span className="brand-hyphen">-</span>Buddy<span className="brand-period">.</span></span>
  </Link>;
}
