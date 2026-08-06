import React, { useEffect } from "react";
import { IoIosLogIn } from "react-icons/io";
import { Box, Typography, Button } from "@mui/material";
import CustomizedInput from "../components/shared/CustomizedInput";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContent"
import { useNavigate } from "react-router-dom";


function Signup() {
  const navigate = useNavigate();
  const auth = useAuth();


  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");
try {
  toast.loading("Signing Up", { id: "signup" });
  const res = await auth?.signup(name, email, password);
  toast.success(res?.message || "Signup Successfully", { id: "signup" });
} catch (error) {
  console.log("Signup Error:", error);

  // yaha dono case cover karne hai:
  // 1) jab api.tsx ne throw { message: "User already exists" }
  // 2) jab koi aur error ho (axios/network etc)
  const errMsg =
    error?.message || error.response?.data?.message || "Signing Up Failed";

  toast.error(errMsg, { id: "signup" });
}
  };


  
  useEffect(() => {
    if (auth?.user) {
       navigate("/chat");
    }
  }, [auth,navigate]);


return (
    <Box width={"100%"} height={"100%"} display="flex" flex={1}>
      <Box padding={8} mt={1} display={{ md: "flex", sm: "none", xs: "none" }}>
        <img  src="airobot.png" alt="Robot" style={{ width: "400px" }} />
      </Box>
      <Box
        display={"flex"}
        flex={{ xs: 1, md: 0.5 }}
        justifyContent={"center"}
        alignItems={"center"}
        padding={2}
        ml={"auto"}
        mt={5}
      >
        <form
         onSubmit={handleSubmit}
          
          style={{
            
            margin: "auto",
            padding: "2rem",
            boxShadow: "10px 10px 20px #000",
            borderRadius: "10px",
            border: "none",
            width: "90%",
            maxWidth: "400px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="h3"
              textAlign="center"
              padding={2}
              fontWeight={600}
            >
             Signup
            </Typography>
            <CustomizedInput type="text" name="name" label="Name"  autoComplete="off" />
            <CustomizedInput type="email" name="email" label="Email" autoComplete="off"  />
            <CustomizedInput type="password" name="password" label="Password" autoComplete="new-password" />
            <Button
              type="submit"
              sx={{
                px: 2,
                py: 1,
                mt: 2,
                width: "100%",
                maxWidth: "400px",
                borderRadius: 2,
                bgcolor: "#00fffc",
                ":hover": { bgcolor: "white", color: "black" },
              }}
              endIcon={<IoIosLogIn />}
            >
              Signup
            </Button>
          </Box>
        </form>
      </Box>
    </Box>
  );
}

export default Signup;
