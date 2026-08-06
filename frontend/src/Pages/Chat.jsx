import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Avatar, Typography, Button, IconButton } from "@mui/material";
import { red } from "@mui/material/colors";
import { useAuth } from "../context/AuthContent";
import ChatItem from "../components/Chat/ChatItem";
import { IoMdSend } from "react-icons/io";
import { useNavigate } from "react-router-dom";


import {
  deleteUserChats,
  getUserChats,
  sendChatRequest,
} from "../helpers/api";


import toast from "react-hot-toast";



function Chat() {

  const navigate = useNavigate();


  const inputRef = useRef(null);
  const auth = useAuth();
  const [chatMessages, setChatMessages] = useState([]);


   const handleSend = async () => {
    if (!inputRef.current) return; // Check for null

    const content = inputRef.current.value;
    if (!content.trim()) return;

    inputRef.current.value = "";

    const newMessage = { role: "user", content };
    setChatMessages((prev) => [...prev, newMessage]);

    try {
      toast.loading("AI-Buddy is thinking...", { id: "chat" });
      const chatData = await sendChatRequest(content);
      setChatMessages([...chatData.chats]);
      toast.success("AI-Buddy replied!", { id: "chat" });
    } catch (error) {
      console.log(error);
      toast.error("AI-Buddy is unable to give an answer.", { id: "chat" });
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleSend();
    }
  };


  //delete chats
  const handleDeleteChats = async () => {
    try {
      toast.loading("Deleting Chats", { id: "deletechats" });
      await deleteUserChats();
      setChatMessages([]);
      toast.success("Deleted Chats Successfully", { id: "deletechats" });
    } catch (error) {
      console.log(error);
      toast.error("Deleting chats failed", { id: "deletechats" });
    }
  };

  //load chats on page load
  useLayoutEffect(() => {
    if (auth?.isLoggedIn && auth.user) {
      toast.loading("Loading Chats", { id: "loadchats" });
      getUserChats()
        .then((data) => {
          setChatMessages([...data.chats]);
          toast.success("Successfully loaded chats", { id: "loadchats" });
        })
        .catch((err) => {
          console.log(err);
          toast.error("Loading Failed", { id: "loadchats" });
        });
    }
  }, [auth]);

  useEffect(() => {
    if (!auth?.user) {
      navigate("/login");
    }
  }, [auth]);


  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        width: "100%",
        height: "100%",
        mt: 3,
        gap: 3,
      }}
    >
      <Box
        sx={{
          display: { md: "flex", xs: "none", sm: "none" },
          flex: 0.2,
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            display: "flex",
            width: "100%",
            height: "60vh",
            bgcolor: "rgb(17,29,39)",
            borderRadius: 5,
            flexDirection: "column",
            mx: 3,
          }}
        >



   <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
  {/* Avatar with initials */}
  <Avatar
    sx={{
      mt: 1,
      bgcolor: "white",
      color: "black",
      fontWeight: 800,
      textTransform: "uppercase",
      width: 62,
      height: 62,
      fontSize: 28,
    }}
  >
    {auth?.user?.name
      ? auth.user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
      : "?"}
  </Avatar>

  {/* Full name below avatar */}
  <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 20, textAlign: "center",  textTransform: "uppercase", }}>
    {auth?.user?.name ? auth.user.name : "Unknown User"}
  </Typography>
</Box>


         <Typography
  sx={{
    mx: "auto",
    fontFamily: "Work Sans, sans-serif",
    fontWeight: 100,
    fontSize: { xs: 16, sm: 18, md: 20 },
    textAlign: "center",
    lineHeight: 1.6,
    color: "#94b8dcff", 
    mt: 2,
   
  }}
>
  <span style={{ 
    fontWeight: 700, 
     color: "#33ffcc",
    fontSize: "1.2em" 
  }}>
    Hey there! You are talking to <span style={{ fontStyle: "italic" }}>AI-Buddy</span>
  </span>
  <br />
  <span style={{fontSize:8}}></span>
  Your friendly, personal AI companion ready to help you learn, code, or just have fun.
</Typography>



          <Button
            onClick={handleDeleteChats}
            sx={{
              width: "200px",
              my: "auto",
              color: "white",
              fontWeight: "700",
              borderRadius: 3,
              mx: "auto",
              bgcolor: red[300],
              ":hover": {
                bgcolor: red.A400,
              },
            }}
          >
            Clear Conversation
          </Button>
        </Box>
      </Box>



      <Box
        sx={{
          display: "flex",
          flex: { md: 0.8, xs: 1, sm: 1 },
          flexDirection: "column",
          px: 3,
        }}
      >
        <Typography
          sx={{
            fontSize: "40px",
            color: "white",
            mb: 2,
            mx: "auto",
            fontWeight: "500",
          }}
        >
          Ask Anything to AI-Buddy
        </Typography>
        <Box
          sx={{
            width: "100%",
            height: "60vh",
            borderRadius: 3,
            mx: "auto",
            display: "flex",
            flexDirection: "column",
            overflow: "scroll",
            overflowX: "hidden",
            overflowY: "auto",
            scrollBehavior: "smooth",
          }}
        >
          {chatMessages.map((chat, index) => (
            <ChatItem content={chat.content} role={chat.role} key={index} />
          ))}
        </Box>
        <div
          style={{
            height: "10vh",
            width: "100%",
            borderRadius: 6,
            backgroundColor: "rgba(45, 58, 73, 1)",
            display: "flex",
            margin: "auto",
          }}
        >
          {" "}
          <input
            ref={inputRef}
            type="text"
              onKeyDown={handleKeyDown} // Added onKeyDown handler
            style={{
              width: "100%",
              backgroundColor: "transparent",
              padding: "30px",
              border: "none",
              outline: "none",
              color: "white",
              fontSize: "20px",
            }}
          />
          <IconButton onClick={handleSend} sx={{ color: "white", mx: 1 }}>
            <IoMdSend />
          </IconButton>
        </div>
      </Box>
    </Box>
  );
}

export default Chat;
