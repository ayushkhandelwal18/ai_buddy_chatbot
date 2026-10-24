import { Link } from "react-router-dom";
import Typography from "@mui/material/Typography";

function Logo() {
  return (
  <div
      style={{
        display: "flex",
        marginRight: "auto",
        alignItems: "center",
        gap: "15px",
      }}
    >
      <Link to={"/"}>
        <img
          src="/logo.png"
          alt="openai"
          width={"35px"}
          height={"35px"}
          className="image-inverted"
        />
      </Link>{" "}
      <Typography
        sx={{
          display: { md: "block", sm: "none", xs: "none" },
          mr: "auto",
          fontWeight: "800",
          textShadow: "2px 2px 20px #000",
        }}
      >
        <span style={{ fontSize: "20px" }}>AI</span>-Buddy
      </Typography>
    </div>
  );
  
}

export default Logo;
