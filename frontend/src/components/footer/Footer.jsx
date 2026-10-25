import { Link } from "react-router-dom";
import { FaGithub } from "react-icons/fa";
import Brand from "../public/Brand";

export default function Footer() {
  return <footer className="public-footer public-container">
    <div className="footer-top"><div><Brand /><p>A conversation with your documents.<br />A clearer way forward.</p></div><nav aria-label="Footer navigation"><a href="/#features">Features</a><a href="/#how-it-works">How it works</a><Link to="/login">Log in</Link><a href="https://github.com/ayushkhandelwal18/AI-Chat-Bot" target="_blank" rel="noopener noreferrer"><FaGithub /> GitHub</a></nav></div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} AI-Buddy. Built with curiosity.</span><span>Created by <a href="https://github.com/ayushkhandelwal18" target="_blank" rel="noopener noreferrer">Ayush Khandelwal</a></span></div>
  </footer>;
}
