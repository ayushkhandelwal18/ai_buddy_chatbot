import { createContext, useEffect, useState, useContext } from "react";
import { checkAuthStatus, loginUser ,userLogout ,signupUser } from "../helpers/api";


const AuthContext =createContext(null);

export const AuthProvider =({children})=>{
   const [user ,setUser] = useState(null);
   const [isLoggedIn , setIsLoggedIn] = useState(false);
   // True while the initial cookie/JWT check is still running. Lets protected
   // pages wait for the session instead of redirecting to /login too early.
   const [isAuthLoading , setIsAuthLoading] = useState(true);



   useEffect(()=>{
    //fetch if the users's cookies are valid then skip login

    async function checkStatus(){
        try{
            const data =await checkAuthStatus();
            if(data){
                setUser({email:data.email , name:data.name});
                setIsLoggedIn(true);
            }
        }catch(error){
            console.log("Auth status check failed:", error);
        }finally{
            setIsAuthLoading(false);
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
        isAuthLoading,
        login,
        signup,
        logout
    };

    return <AuthContext.Provider value={value}>

        {children}

    </AuthContext.Provider>



};


export const useAuth = () =>  useContext(AuthContext);
