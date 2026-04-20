import { createContext, useContext, ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCredentials, logout } from "@/store/slices/authSlice";
import { useLoginMutation, useSignupMutation } from "@/store/api/apiSlice";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/utils";

interface AuthContextType {
  user: any;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);
  const isLoading = useAppSelector((state) => state.auth.isLoading);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  
  const [loginMutation] = useLoginMutation();
  const [signupMutation] = useSignupMutation();

  const login = async (email: string, password: string) => {
    try {
      const result = await loginMutation({ email, password }).unwrap();
      dispatch(setCredentials({ user: result.user, token: result.token }));
      toast.success("Logged in successfully");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const result = await signupMutation({ email, password, name }).unwrap();
      dispatch(setCredentials({ user: result.user, token: result.token }));
      toast.success("Account created and logged in");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      throw error;
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    toast.success("Logged out");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        signup,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
