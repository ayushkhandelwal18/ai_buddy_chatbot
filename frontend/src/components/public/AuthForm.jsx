import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import { MdArrowForward, MdLockOutline, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { useAuth } from "../../context/AuthContent";

const validate = (values, signup) => {
  const errors = {};
  if (signup && (!values.name.trim() || values.name.trim().length > 100)) errors.name = "Enter your name (up to 100 characters).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) errors.email = "Enter a valid email address.";
  const password = values.password.trim(); // Matches the existing server's password normalization.
  if (password.length < 6) errors.password = "Use at least 6 characters for your password.";
  else if (signup && new TextEncoder().encode(password).length > 72) errors.password = "This password is too long. Use a shorter password (up to 72 UTF-8 bytes).";
  if (signup && values.confirmPassword !== values.password) errors.confirmPassword = "Your passwords do not match.";
  return errors;
};

export default function AuthForm({ mode }) {
  const signup = mode === "signup";
  const auth = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState({});
  const mounted = useRef(false);
  const submitting = useRef(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!auth.isAuthLoading && auth.isLoggedIn) navigate("/chat", { replace: true }); }, [auth.isAuthLoading, auth.isLoggedIn, navigate]);

  const change = (event) => {
    const { name, value } = event.target;
    const next = { ...values, [name]: value };
    setValues(next); setServerError("");
    if (errors[name] || (name === "password" && errors.confirmPassword)) {
      const current = validate(next, signup);
      setErrors((previous) => ({ ...previous, [name]: current[name], ...(name === "password" ? { confirmPassword: current.confirmPassword } : {}) }));
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || auth.isAuthLoading) return;
    const issues = validate(values, signup);
    setErrors(issues); setServerError("");
    if (Object.keys(issues).length) { document.getElementById(`auth-${Object.keys(issues)[0]}`)?.focus(); return; }
    submitting.current = true; setBusy(true);
    try {
      if (signup) await auth.signup(values.name.trim(), values.email.trim(), values.password);
      else await auth.login(values.email.trim(), values.password);
      if (mounted.current) navigate("/chat", { replace: true });
    } catch (error) {
      if (mounted.current) { setServerError(error.message || "We couldn’t complete your request. Please try again."); setErrors(error.fields || {}); }
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };

  const field = (name, label, type = "text", autoComplete = name) => {
    const password = type === "password";
    return <div className="auth-field" key={name}>
      <label htmlFor={`auth-${name}`}>{label}</label>
      <div className={`auth-input-wrap${errors[name] ? " has-error" : ""}`}>
        <input id={`auth-${name}`} name={name} type={password && visible[name] ? "text" : type} value={values[name]} onChange={change}
          onBlur={() => setErrors((current) => ({ ...current, [name]: validate(values, signup)[name] }))}
          autoComplete={autoComplete} required disabled={busy || auth.isAuthLoading}
          maxLength={name === "name" ? 100 : name === "email" ? 254 : signup ? 72 : undefined}
          aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : signup && name === "password" ? "password-help" : undefined}
          placeholder={name === "name" ? "Your name" : name === "email" ? "you@example.com" : name === "confirmPassword" ? "Enter your password again" : signup ? "Create a password" : "Enter your password"} />
        {password && <button type="button" className="password-toggle" disabled={busy || auth.isAuthLoading}
          onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}
          aria-label={`${visible[name] ? "Hide" : "Show"} ${name === "confirmPassword" ? "confirm password" : "password"}`} aria-pressed={!!visible[name]}>
          {visible[name] ? <MdVisibilityOff /> : <MdVisibility />}
        </button>}
      </div>
      {errors[name] && <span className="field-error" id={`error-${name}`}>{errors[name]}</span>}
      {signup && name === "password" && !errors[name] && <span className="field-hint" id="password-help">At least 6 characters. Make it uniquely yours.</span>}
    </div>;
  };

  return <div className="auth-form-content">
    <span className="section-eyebrow">{signup ? "YOUR NEXT CHAPTER" : "WELCOME BACK"}</span>
    <h1>{signup ? "A workspace for\nyour next big idea." : "Good to see\nyou again."}</h1>
    <p className="auth-form-description">{signup ? "Create your account and start a conversation with your documents." : "Log in to your documents, conversations, and saved ideas."}</p>
    <form onSubmit={submit} noValidate aria-label={signup ? "Create account" : "Log in"} aria-busy={busy}>
      {serverError && <div className="auth-error" role="alert">{serverError}</div>}
      {signup && field("name", "Your name", "text", "name")}
      {field("email", "Email address", "email", "username")}
      {field("password", "Password", "password", signup ? "new-password" : "current-password")}
      {signup && field("confirmPassword", "Confirm password", "password", "new-password")}
      <button className="public-btn public-btn-primary auth-submit" type="submit" disabled={busy || auth.isAuthLoading}>
        {busy || auth.isAuthLoading ? <><CircularProgress size={17} color="inherit" />{busy ? (signup ? "Creating your account…" : "Logging in…") : "Checking your session…"}</> : <>{signup ? "Create account" : "Log in"}<MdArrowForward /></>}
      </button>
    </form>
    <p className="auth-switch">{signup ? "Already have an account?" : "New to AI-Buddy?"} <Link to={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Create an account"}<MdArrowForward /></Link></p>
    <span className="auth-session-note"><MdLockOutline /> Email, password, and you. That’s all you need.</span>
  </div>;
}
