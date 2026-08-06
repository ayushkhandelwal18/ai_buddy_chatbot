import  User  from '../models/user.model.js';
import {hash,compare} from "bcrypt";
import { createToken } from '../utils/token-manager.js';
import { COOKIE_NAME } from '../utils/constant.js';



export const getAllUsers = async (
    req,
    res,
    next ) => {
 try{
    const users =await User.find();
    return res.status(200).json({
        status: "success",
        message: "Users fetched successfully",
        data: users});

 }catch(error){
    console.log(error);
    return res.status(200).json({message:"Error fetching users", error: error.message});    
 }
};

export const usersignup = async (
    req,
    res,
    next ) => {
 try{
    const{name,email,password}=req.body;

    const exixstinguser =await User.findOne({email});
    if(exixstinguser){
        return res.status(401).json({message:"User already exists"});
    }

    const hashedPassword = await hash(password, 10); // Hashing the password

    const users = new User({name,email,password:hashedPassword});
    await users.save();

    // Check if user was created successfully
    // if (!users || !users._id) {
    //     return res.status(500).json({message: "User creation failed"});
    // }


 
    //agar purana token hai to clear krdo
      res.clearCookie(COOKIE_NAME, {
  httpOnly: true,
  signed: true,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
});
 

    const token = createToken(users._id.toString(), users.email, "7d");
    
    const expires = new Date();
    expires.setDate(expires.getDate()+7);
  
    //token genrate hojaye uper wale se  
   //use cookie-parser for send token in cookie (backend to frontend)
res.cookie(COOKIE_NAME, token, {
  path: "/",
  expires,
  httpOnly: true,
  signed: true,
  secure: process.env.NODE_ENV === "production",  // prod me true hoga
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // local pe lax
});


    return res.status(201).json({
        message: "User created successfully",
        name: users.name,
        email: users.email
    });

 }catch(error){
    console.log(error);
    return res.status(200).json({message:"Error fetching users", cause:error.message});    
 }
};

export const userlogin = async (
    req,
    res,
    next ) => {
 try{
    const{email,password}=req.body;

    const exixstinguser =await User.findOne({email});
    if(!exixstinguser){
        return res.status(401).send({message:"User does not exists"});
    }

    const isPasswordValid =await compare(password , exixstinguser.password);
    if(!isPasswordValid){
        return res.status(403).send({message:"Invalid credentials"});
    }


    //agar purana token hai to clear krdo
      res.clearCookie(COOKIE_NAME, {
  httpOnly: true,
  signed: true,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
});

    const token = createToken(exixstinguser._id.toString(), exixstinguser.email, "7d");
    
    const expires = new Date();
    expires.setDate(expires.getDate()+7);
  
    //token genrate hojaye uper wale se  
   //use cookie-parser for send token in cookie (backend to frontend)
res.cookie(COOKIE_NAME, token, {
  path: "/",
  expires,
  httpOnly: true,
  signed: true,
  secure: process.env.NODE_ENV === "production",  // prod me true hoga
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // local pe lax
});
     

    return res.status(200).json({message:"Login successful", name:exixstinguser.name, email:exixstinguser.email,token});


}catch(error){
    console.log(error);
    return res.status(200).json({message:"Error fetching users", error: error.message});    
 }
};


export const verifyUser = async (
  req,
  res,
  next
) => {
  try {
    //user token check
    const user = await User.findById(res.locals.jwtData.id);
    if (!user) {
      return res.status(401).send("User not registered OR Token malfunctioned");
    }
    if (user._id.toString() !== res.locals.jwtData.id) {
      return res.status(401).send("Permissions didn't match");
    }
    return res
      .status(200)
      .json({ message: "OK", name: user.name, email: user.email });
  } catch (error) {
    console.log(error);
    return res.status(200).json({ message: "ERROR", cause: error.message });
  }
};

export const userlogout = async (
  req,
  res,
  next
) => {
  try {
    //user token check
    const user = await User.findById(res.locals.jwtData.id);
    if (!user) {
      return res.status(401).send("User not registered OR Token malfunctioned");
    }
    if (user._id.toString() !== res.locals.jwtData.id) {
      return res.status(401).send("Permissions didn't match");
    }
   
    //clear cookies for logout
          res.clearCookie(COOKIE_NAME, {
  httpOnly: true,
  signed: true,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
});


    return res
      .status(200)
      .json({ message: "OK", name: user.name, email: user.email });
  } catch (error) {
    console.log(error);
    return res.status(200).json({ message: "ERROR", cause: error.message });
  }
};
