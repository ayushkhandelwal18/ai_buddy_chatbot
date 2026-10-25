import AuthLayout from "../components/public/AuthLayout";
import AuthForm from "../components/public/AuthForm";

export default function Login() {
  return <AuthLayout><AuthForm mode="login" /></AuthLayout>;
}
