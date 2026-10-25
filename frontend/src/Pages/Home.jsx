import { Link } from "react-router-dom";
import { MdArrowForward, MdAutoAwesome, MdCheck, MdDescription, MdHistory, MdHub, MdOutlineFormatQuote, MdOutlinePsychology, MdSearch, MdUploadFile } from "react-icons/md";
import { useAuth } from "../context/AuthContent";
import ProductPreview from "../components/public/ProductPreview";
import Footer from "../components/footer/Footer";

const features = [
  { Icon: MdDescription, title: "Chat with your PDFs", text: "Go from a long document to a useful conversation. Upload a PDF and ask what’s on your mind.", tag: "Less scrolling. More insight." },
  { Icon: MdHub, title: "Context makes the difference", text: "RAG brings relevant document passages into the conversation, so answers have something to build on.", tag: "Retrieval-augmented generation" },
  { Icon: MdSearch, title: "Search beyond keywords", text: "Find related ideas through semantic search, even when your question uses different words.", tag: "Powered by vector search" },
  { Icon: MdOutlineFormatQuote, title: "See where answers come from", text: "Document answers include source references and page numbers, so you can check the original context.", tag: "Connected to the source" },
  { Icon: MdHistory, title: "Keep the conversation going", text: "Return to saved conversations, revisit an idea, and pick up where you left off.", tag: "Your workspace, in context" },
  { Icon: MdOutlinePsychology, title: "A little more personal", text: "Explicitly shared facts and supported preferences can carry across chats. View, pause, or delete that memory.", tag: "Memory you control" },
];
const uploadSteps = [{ Icon: MdDescription, label: "PDF" }, { Icon: MdUploadFile, label: "Text extraction" }, { Icon: MdHub, label: "Chunking" }, { Icon: MdAutoAwesome, label: "Embeddings" }];
const answerSteps = [{ Icon: MdSearch, label: "Qdrant search" }, { Icon: MdDescription, label: "Retrieved context" }, { Icon: MdAutoAwesome, label: "Gemini response" }];

export default function Home() {
  const auth = useAuth();
  const start = auth?.isLoggedIn ? "/chat" : "/signup";
  return <>
    <section className="landing-hero public-container" aria-labelledby="hero-title">
      <div className="hero-copy">
        <span className="hero-eyebrow"><span /> Less searching. More understanding.</span>
        <h1 id="hero-title">Your documents.<br />Your knowledge.<br /><span>One AI.</span></h1>
        <p className="hero-description">Upload your PDFs. Ask in your own words. Get answers grounded in your documents, with the context to see the bigger picture.</p>
        <div className="hero-actions"><Link to={start} className="public-btn public-btn-primary">Start chatting<MdArrowForward /></Link><a href="#features" className="public-btn public-btn-secondary">Explore features <span aria-hidden="true">↗</span></a></div>
        <div className="hero-notes"><span><MdCheck /> Powered by RAG</span><span><MdCheck /> Sources included</span><span><MdCheck /> Your own workspace</span></div>
      </div>
      <div className="hero-preview"><div className="preview-orbit" aria-hidden="true" /><ProductPreview /></div>
    </section>

    <div className="technology-strip public-container"><span>A little intelligence.<br /><strong>A lot of context.</strong></span><div><span><MdAutoAwesome /> Gemini</span><i /><span><MdHub /> Qdrant</span><i /><span><MdDescription /> PDF knowledge</span></div><p>Built around your documents.<br />Designed around your questions.</p></div>

    <section className="public-section public-container" id="features" aria-labelledby="features-title">
      <div className="section-heading"><div><span className="section-eyebrow">MORE THAN A CHAT WINDOW</span><h2 id="features-title">Your information,<br />working with you.</h2></div><p>From the first question to the next big idea.<br />One thoughtful workspace to connect it all.</p></div>
      <div className="feature-grid">{features.map(({ Icon, title, text, tag }, index) => <article className="feature-card" key={title}><span className={`feature-icon feature-icon-${index}`}><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p><span className="feature-tag">{tag}<MdArrowForward aria-hidden="true" /></span></article>)}</div>
    </section>

    <section className="how-section public-section" id="how-it-works" aria-labelledby="how-title">
      <div className="public-container">
        <div className="section-heading section-heading-centered"><span className="section-eyebrow">FROM FILE TO FIRST INSIGHT</span><h2 id="how-title">Bring a document.<br />Follow your curiosity.</h2><p>Three simple steps. Plenty of possibilities.</p></div>
        <ol className="how-steps">
          <li><span className="step-number">01</span><div className="step-icon"><MdUploadFile /></div><h3>Upload</h3><p>Add a PDF from the + menu. AI-Buddy prepares the text and lets you know when it’s ready.</p><span className="step-detail">Your starting point</span></li>
          <li><span className="step-number">02</span><div className="step-icon"><MdSearch /></div><h3>Retrieve</h3><p>Ask a question. Semantic search finds relevant passages from your attached documents.</p><span className="step-detail">The right context</span></li>
          <li><span className="step-number">03</span><div className="step-icon"><MdAutoAwesome /></div><h3>Ask & understand</h3><p>Read an answer informed by those passages, with source pages to help you explore further.</p><span className="step-detail">A clearer perspective</span></li>
        </ol>
      </div>
    </section>

    <section className="rag-section public-container" id="rag-technology" aria-labelledby="rag-title">
      <div className="rag-copy"><span className="section-eyebrow">GOOD ANSWERS HAVE ROOTS</span><h2 id="rag-title">Not just an answer.<br />An answer with context.</h2><p>Retrieval-augmented generation connects Gemini to the relevant parts of your PDFs. Qdrant finds the passages; Gemini helps make sense of them.</p><p className="rag-footnote">Documents are processed when uploaded. Each question searches the ready document index.</p><a href="#how-it-works" className="rag-link">See how it comes together <MdArrowForward /></a></div>
      <div className="rag-diagram" aria-label="PDF processing: text extraction, chunking, and embeddings into Qdrant. Questions retrieve context from Qdrant for Gemini.">
        <div className="pipeline-label"><span>01 / WHEN YOU UPLOAD</span><span>Prepare your knowledge</span></div>
        <div className="pipeline-row">{uploadSteps.map(({ Icon, label }) => <div className="pipeline-node" key={label}><Icon aria-hidden="true" /><span>{label}</span></div>)}</div>
        <div className="vector-index"><span className="vector-dot-grid" aria-hidden="true">⠿</span><div><strong>Qdrant vector index</strong><span>Your document chunks, ready to search</span></div><span className="index-label">STORED CONTEXT</span></div>
        <div className="pipeline-label"><span>02 / WHEN YOU ASK</span><span>Question → query embedding</span></div>
        <div className="pipeline-row pipeline-row-answer">{answerSteps.map(({ Icon, label }) => <div className="pipeline-node" key={label}><Icon aria-hidden="true" /><span>{label}</span></div>)}</div>
        <div className="pipeline-result"><MdCheck /> Relevant context. Clearer answers. Source references.</div>
      </div>
    </section>

    <section className="final-cta public-container" aria-labelledby="cta-title"><span className="cta-spark" aria-hidden="true"><MdAutoAwesome /></span><span className="section-eyebrow">YOUR NEXT INSIGHT IS WAITING</span><h2 id="cta-title">Turn your documents<br />into knowledge.</h2><p>Start asking better questions about the information you already have.</p><Link to={start} className="public-btn public-btn-primary">Get started<MdArrowForward /></Link><span className="cta-note">A PDF. A question. A fresh perspective.</span></section>
    <Footer />
  </>;
}
