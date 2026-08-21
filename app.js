const express = require("express");
const path = require("path");
const exphbs = require("express-handlebars");
const sequelize = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes"); // ✅ add this
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

// Handlebars setup
app.engine("hbs", exphbs.engine({ extname: ".hbs", defaultLayout: "main" }));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use("/auth", authRoutes);
app.use("/", userRoutes); // ✅ mount user routes

// Root route: gatekeeper
app.get("/", (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, "SECRET_KEY");
    return res.redirect(`/profile/${decoded.id}`);
  } catch {
    return res.redirect("/login");
  }
});

// Page routes
app.get("/login", (req, res) => res.render("auth/login", { title: "Login Page" }));
app.get("/register", (req, res) => res.render("auth/register", { title: "Register Page" }));

sequelize.sync().then(() => {
  app.listen(3000, () => console.log("Server running on http://localhost:3000"));
});
