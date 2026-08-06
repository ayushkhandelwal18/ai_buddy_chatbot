import { createContext, useEffect, useState, useContext } from "react";
import { checkAuthStatus, loginUser ,userLogout ,signupUser } from "../helpers/api";


const AuthContext =createContext(null);

export const AuthProvider =({children})=>{
   const [user ,setUser] = useState(null);
   const [isLoggedIn , setIsLoggedIn] = useState(false);



   useEffect(()=>{
    //fetch if the users's cookies are valid then skip login

    async function checkStatus(){
        const data =await checkAuthStatus();
        if(data){
        setUser({email:data.email , name:data.name});
        setIsLoggedIn(true);
    }
   }
    checkStatus();

   }, []);

   const login =async(email,password)=>{ 
    const data =await loginUser(email,password);
    if(data){
        setUser({email:data.email , name:data.name});
        setIsLoggedIn(true);
    }
    return data;
   };




    const signup =async(name,email,password)=>{ 
          const data =await signupUser(name,email,password);
    if(data){
        setUser({email:data.email , name:data.name});
        setIsLoggedIn(true);
    }
    return data;
    };

    
    const logout =async()=>{ 
        await userLogout();
        setIsLoggedIn(false);
        setUser(null);
        window.location.reload();//reload krenge page ko after logout 
        //bcz time leti hai cookie delete hone me
    };


    const value ={
        user,
        isLoggedIn,
        login,
        signup,
        logout
    };

    return <AuthContext.Provider value={value}>

        {children}

    </AuthContext.Provider>



};


export const useAuth = () =>  useContext(AuthContext);
