const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const UserProfile = require("../models/userProfile");

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Check if username already exists
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.render("auth/register", { error: "Username already taken" });
    }

    // Same check for email -- without it, a colliding email falls through
    // to the generic catch below with a raw Sequelize error message instead
    // of the same "already taken" wording setup-accounts.js's response
    // matcher (and human users) already recognize for a duplicate username.
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.render("auth/register", { error: "Email already taken" });
      }
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

  // Suspended accounts cannot log in. Checked AFTER the password check so we
  // don't reveal an account's status to someone who doesn't know the password.
  const profile = await UserProfile.findByPk(user.userID);
  if (profile && profile.isDeleted) {
    return res.render("auth/login", { error: "This account has been suspended." });
  }

  // Create JWT token
  const token = jwt.sign(
    { id: user.userID, username: user.username },
    "SECRET_KEY",
    { expiresIn: "15m" }
  );

  // Store token in cookie
  res.cookie("token", token, { httpOnly: true });

  // Redirect to home feed
  res.redirect("/feed");
};
