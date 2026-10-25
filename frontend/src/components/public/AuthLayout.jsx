import { Link } from "react-router-dom";
import { MdArrowBack, MdAutoAwesome, MdCheckCircle, MdDescription, MdOutlineForum, MdOutlinePsychology, MdSearch } from "react-icons/md";
import Brand from "./Brand";

export default function AuthLayout({ children }) {
  return <div className="auth-page">
    <header className="auth-header"><Brand /><Link className="back-home" to="/"><MdArrowBack /> Back to home</Link></header>
    <div className="auth-layout">
      <aside className="auth-story">
        <span className="section-eyebrow">A LITTLE CONTEXT CHANGES EVERYTHING</span>
        <h2>Your documents.<br />A world of possibilities.</h2>
        <p>Spend less time looking for answers.<br />Start a conversation with what you know.</p>
        <div className="auth-document-visual" aria-label="Illustrative document answer">
          <div className="auth-visual-file"><span className="pdf-icon"><MdDescription /></span><div><strong>Learning notes.pdf</strong><span>Ready for your next question</span></div><MdCheckCircle className="ready-icon" /></div>
          <div className="auth-visual-connector"><span /><MdSearch /><span /></div>
          <div className="auth-visual-answer"><span className="auth-spark"><MdAutoAwesome /></span><div><strong>Connect the dots.</strong><p>Explore an idea, unpack a concept, or find that detail you were looking for.</p><span className="auth-source-chip">Learning notes.pdf · page 3</span></div></div>
          <span className="auth-visual-caption">Illustrative example</span>
        </div>
        <div className="auth-benefits"><span><MdDescription /> Document-grounded answers</span><span><MdOutlineForum /> Conversations that stay with you</span><span><MdOutlinePsychology /> Memory you can manage</span></div>
      </aside>
      <section className="auth-form-panel" aria-label="Account access">{children}</section>
    </div>
    <footer className="auth-footer">Your next insight starts with a question.<span>© {new Date().getFullYear()} AI-Buddy</span></footer>
  </div>;
}
