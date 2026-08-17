const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Check if username already exists
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.render("auth/register", { error: "Username already taken" });
    }

    // Hash password and create user
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash: hash });

    // After registration, prompt user to login
    res.render("auth/register", { success: "Registration successful, please login" });
  } catch (err) {
    res.render("auth/register", { error: "Error: " + err.message });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  // Find user by username
  const user = await User.findOne({ where: { username } });
  if (!user) {
    return res.render("auth/login", { error: "Invalid credentials" });
  }

  // Compare password with stored hash
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.render("auth/login", { error: "Invalid credentials" });
  }

  // Create JWT token
  const token = jwt.sign(
    { id: user.userID, username: user.username },
    "SECRET_KEY",
    { expiresIn: "15m" }
  );

  // Store token in cookie
  res.cookie("token", token, { httpOnly: true });

  // Redirect to profile page
  res.redirect(`/profile/${user.userID}`);
};
