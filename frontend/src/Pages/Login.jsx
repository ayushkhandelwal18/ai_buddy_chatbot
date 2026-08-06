import React, { useEffect } from "react";
import { IoIosLogIn } from "react-icons/io";
import { Box, Typography, Button } from "@mui/material";
import CustomizedInput from "../components/shared/CustomizedInput";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContent";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const email = formData.get("email");
    const password = formData.get("password");

    try {
      toast.loading("Signing In", { id: "login" });

      const res = await auth?.login(email, password);

      // If your API returns a message, you can show it dynamically
      toast.success(res?.message || "Signed In Successfully", {
        id: "login",
      });
    } catch (error) {
      console.log("Login Error:", error);

      // Cover both API errors and network/axios errors
      const errMsg =
        error?.message || error.response?.data?.message || "Signing In Failed";

      toast.error(errMsg, { id: "login" });
    }
  };

  useEffect(() => {
    if (auth?.user) {
      navigate("/chat");
    }
  }, [auth]);

  return (
    <Box width={"100%"} height={"100%"} display="flex" flex={1}>
      <Box padding={8} mt={1} display={{ md: "flex", sm: "none", xs: "none" }}>
        <img src="airobot.png" alt="Robot" style={{ width: "400px" }} />
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
              Login
            </Typography>
            <CustomizedInput
              type="email"
              name="email"
              label="Email"
              autoComplete="off"
            />
            <CustomizedInput
              type="password"
              name="password"
              label="Password"
              autoComplete="new-password"
            />

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
              Login
            </Button>
          </Box>
        </form>
      </Box>
    </Box>
  );
}

export default Login;
