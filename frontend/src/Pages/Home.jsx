import { Box, useMediaQuery, useTheme } from "@mui/material";
import  { useEffect } from "react";   
import TypingAnim from "../components/typeranimation/Typinganimation";
import Footer from "../components/footer/Footer";



function Home() {
  const theme = useTheme();
  const isBelowMd = useMediaQuery(theme.breakpoints.down("md"));

   // Robo voice on homepage load
  useEffect(() => {
  if (!window.hasWelcomed) {        //  ek custom flag
    const utterance = new SpeechSynthesisUtterance("Welcome to AI Buddy");
    utterance.pitch = 1.2;
    utterance.rate = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
    window.hasWelcomed = true;      // dubara mat bolna
  }
}, []);


  return (
    <Box width={"100%"} height={"100%"}>
      <Box
        sx={{
          display: "flex",
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
          mx: "auto",
          mt: 3,
        }}
      >
        <Box>
          <TypingAnim />
        </Box>




       <Box sx={{
  display: "flex",
  width: "100%",
  flexDirection: { xs: "column", sm: "column", md: "row" },
  alignItems: "center",
  justifyContent: "center",
  gap: { xs: 3, sm: 4, md: 5 },
  my: { xs: 5, sm: 8, md: 10 }
}}>
  <img className="tilt" src="robot.png" alt="robot" style={{ width: "150px", maxWidth: "40%", margin: "auto" }}/>
  <img className="image-inverted rotate" src="aicircle.png" alt="openai" style={{ width: "150px", maxWidth: "40%", margin: "auto" }}/>
</Box>


        
        <Box sx={{ display: "flex", mx: "auto" }}>
          <img
            src="chatt.png"
            alt="chatbot"
            style={{
              display: "flex",
              margin: "auto",
              width: isBelowMd ? "80%" : "60%",
              borderRadius: 20,
              boxShadow: "-5px -5px 105px #64f3d5",
              marginTop: 20,
              marginBottom: 20,
              padding: 10,
            }}
          />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}

export default Home;
