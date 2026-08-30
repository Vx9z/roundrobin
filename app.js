const express = require("express");
const path = require("path");
const exphbs = require("express-handlebars");
const sequelize = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");          // identity + relationships
const userProfileRoutes = require("./routes/userProfileRoutes"); // profile settings
const uploadRoutes = require("./routes/uploadRoutes");      // raw uploads
const postRoutes = require("./routes/postRoutes");          // posts + home feed + suggested
const commentRoutes = require("./routes/commentRoutes");    // flat post comments
const reactionRoutes = require("./routes/reactionRoutes");  // like/unlike
const bookmarkRoutes = require("./routes/bookmarkRoutes");  // bookmarks
const repostRoutes = require("./routes/repostRoutes");      // reposts
const notificationRoutes = require("./routes/notificationRoutes"); // notification list + read
const communityRoutes = require("./routes/communityRoutes");       // browse/create/join/leave + boards
const moderationRoutes = require("./routes/moderationRoutes");     // community + platform moderation
const cookieParser = require("cookie-parser");
const { getCurrentUserID } = require("./middleware/auth");
const { attachNavContext } = require("./middleware/navContext");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // serve uploaded files
app.use(cookieParser());

// Sets res.locals.navUserID / unreadCount / isGeneralMod for the shared navbar.
// Express merges res.locals into every res.render, so no controller changes are needed.
app.use(attachNavContext);

// Mount routes
app.use("/auth", authRoutes);
app.use("/", userRoutes);          // search/view/follow/unfollow/block
app.use("/", userProfileRoutes);   // edit/update profile settings
app.use("/", postRoutes);          // create/view/delete posts + feed + suggested
app.use("/", commentRoutes);       // comment on posts
app.use("/", reactionRoutes);      // like/unlike posts
app.use("/", bookmarkRoutes);      // bookmark posts
app.use("/", repostRoutes);        // repost posts
app.use("/", notificationRoutes);  // notification list + mark read
app.use("/", communityRoutes);     // browse/create/join/leave communities + boards
app.use("/", moderationRoutes);    // community mod dashboard + admin dashboard
app.use(uploadRoutes);             // upload endpoints

// Handlebars setup
app.engine("hbs", exphbs.engine({
  extname: ".hbs",
  defaultLayout: "main",
  helpers: {
    isVideoURL: (url) => typeof url === "string" && /\.(mp4|webm|mov|ogg)$/i.test(url)
  }
}));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Root route: gatekeeper
app.get("/", (req, res) => {
  const currentUserID = getCurrentUserID(req);
  if (!currentUserID) return res.redirect("/login");
  return res.redirect("/feed");
});

// Page routes
app.get("/login", (req, res) => res.render("auth/login", { title: "Login Page" }));
app.get("/register", (req, res) => res.render("auth/register", { title: "Register Page" }));

sequelize.sync().then(() => {
  app.listen(3000, () => console.log("Server running on http://localhost:3000"));
});
