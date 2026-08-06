// import React from "react";
import { Link } from "react-router-dom";


function Notfound() {
  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "20px",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem", color: "#ff4d4d" }}>
        404 - Page Not Found
      </h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "2rem" }}>
        Oops! The page you are looking for does not exist.
      </p>

      <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
        <Link
          to="/"
          style={{
            backgroundColor: "#00bfff",
            padding: "10px 20px",
            borderRadius: "8px",
            textDecoration: "none",
            color: "white",
            fontWeight: "bold",
          }}
        >
          Go to Home
        </Link>

        <Link
          to="/login"
          style={{
            backgroundColor: "#4caf50",
            padding: "10px 20px",
            borderRadius: "8px",
            textDecoration: "none",
            color: "white",
            fontWeight: "bold",
          }}
        >
          Login
        </Link>

        <Link
          to="/signup"
          style={{
            backgroundColor: "#ff9800",
            padding: "10px 20px",
            borderRadius: "8px",
            textDecoration: "none",
            color: "white",
            fontWeight: "bold",
          }}
        >
          Signup
        </Link>
      </div>
    </div>
  );
}

export default Notfound;
