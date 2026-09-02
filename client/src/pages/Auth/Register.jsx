import { useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

function Register() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    dob: ""
  });

  const [passwordStrength, setPasswordStrength] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------- Password Strength ---------------- */
  const getPasswordStrength = (password) => {
    if (password.length < 6) return "Weak";
    if (/[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password))
      return "Strong";
    return "Medium";
  };

  /* ---------------- Input Handler ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "password") {
      setPasswordStrength(getPasswordStrength(value));
    }
  };

  /* ---------------- Submit (Register & Send Verification Link) ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (passwordStrength === "Weak") {
      alert("Password is too weak");
      return;
    }

    setIsSubmitting(true);
    try {
      // Assuming your backend 'register' now handles sending a verification email
      await register({ ...formData });
      
      alert("Registration successful! Please check your email to verify your account.");
      navigate("/login"); // Redirect to login after successful registration
    } catch (err) {
      alert(err.response?.data?.message || "Failed to register. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded shadow-md w-96"
      >
        <h1 className="text-2xl font-semibold text-center mb-6">Create Account</h1>

        <div className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            onChange={handleChange} 
            className="border p-2 w-full rounded focus:ring-2 focus:ring-purple-500 outline-none"
            required
          />

          <input
            type="text"
            name="username"
            placeholder="Username"
            onChange={handleChange}
            className="border p-2 w-full rounded focus:ring-2 focus:ring-purple-500 outline-none"
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            onChange={handleChange}
            className="border p-2 w-full rounded focus:ring-2 focus:ring-purple-500 outline-none"
            required
          />

          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              onChange={handleChange}
              className="border p-2 w-full rounded focus:ring-2 focus:ring-purple-500 outline-none"
              required
            />
            {passwordStrength && (
              <p className={`text-xs mt-1 font-medium ${
                passwordStrength === "Weak" ? "text-red-500" : 
                passwordStrength === "Medium" ? "text-yellow-500" : "text-green-600"
              }`}>
                Strength: {passwordStrength}
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Date of Birth</label>
            <input
              type="date"
              name="dob"
              onChange={handleChange}
              className="border p-2 w-full rounded focus:ring-2 focus:ring-purple-500 outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full text-white p-2 rounded transition-colors ${
              isSubmitting ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
            }`}
          >
            {isSubmitting ? "Processing..." : "Register & Verify Email"}
          </button>
        </div>

        <p className="text-sm text-center mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-600 font-medium hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;