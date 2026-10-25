import { MdAdd, MdArrowUpward, MdAutoAwesome, MdCheckCircle, MdDescription, MdOutlineChatBubbleOutline, MdMoreHoriz } from "react-icons/md";

export default function ProductPreview() {
  return <figure className="product-figure" aria-label="Illustrative AI-Buddy document conversation">
    <div className="product-window">
      <div className="preview-window-bar"><span className="window-dots" aria-hidden="true"><i /><i /><i /></span><span>ai-buddy / workspace</span><span className="preview-demo-tag">Product preview</span></div>
      <div className="preview-workspace">
        <aside className="preview-sidebar" aria-label="Example conversation sidebar">
          <div className="preview-brand"><MdAutoAwesome /> AI-Buddy</div>
          <div className="preview-new-chat"><MdAdd /> New conversation</div>
          <span className="preview-sidebar-label">YOUR WORKSPACE</span>
          <div className="preview-nav-active"><MdOutlineChatBubbleOutline /> Product strategy</div>
          <div className="preview-nav-item"><MdOutlineChatBubbleOutline /> Research notes</div>
          <div className="preview-nav-item"><MdOutlineChatBubbleOutline /> A little inspiration</div>
          <div className="preview-sidebar-bottom"><span className="preview-person">JD</span><span>Jamie&apos;s workspace</span></div>
        </aside>
        <div className="preview-chat">
          <div className="preview-chat-heading">Product strategy <MdMoreHoriz aria-hidden="true" /></div>
          <div className="preview-document"><span className="pdf-icon"><MdDescription /></span><div><strong>Product strategy.pdf</strong><span><MdCheckCircle /> Ready to explore</span></div><span className="file-extension">PDF</span></div>
          <div className="preview-question">What are the priorities for the next release?</div>
          <div className="preview-answer">
            <span className="preview-answer-icon" aria-hidden="true"><MdAutoAwesome /></span>
            <div><span className="preview-answer-name">AI-Buddy</span><p>The plan focuses on three priorities:</p>
              <ol><li><strong>Simpler onboarding</strong><span>Help new users reach their first insight.</span></li><li><strong>Better document search</strong><span>Make relevant information easier to find.</span></li><li><strong>Clearer source references</strong><span>Keep answers connected to their context.</span></li></ol>
              <div className="preview-source"><MdDescription /><span>Product strategy.pdf <b>·</b> page 12 <b>·</b> [S1]</span></div>
            </div>
          </div>
          <div className="preview-composer" aria-hidden="true"><MdAdd /><span>Ask a follow-up question…</span><span className="preview-send"><MdArrowUpward /></span></div>
        </div>
      </div>
    </div>
    <figcaption><span className="caption-dot" /> A little context. A much better answer. <span>Sample content, not live data.</span></figcaption>
  </figure>;
}
