const express = require("express");
const morgan = require("morgan");
const bodyParser = require("express").json;
const multer = require("multer");

const app = express();
app.use(morgan("dev"));
app.use(bodyParser());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.use((req, res, next) => {
  console.log(`Request masuk ke API: ${req.method} ${req.url}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

const delayResponse = (time) =>
  new Promise((resolve) => setTimeout(resolve, time));

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    console.error("No file uploaded");
    return res.status(400).send({ message: "No file uploaded." });
  }

  console.log("File received:", req.file);
  res.send({
    message: "File uploaded successfully.",
    file: req.file,
  });
});

app.get("/", (req, res) => {
  const { name, age, location } = req.query;
  res.send({ message: "Welcome to the website!", name, age, location });
});

app.get("/about", async (req, res) => {
  await delayResponse(50);
  const { s, c } = req.query;
  res.send({ message: "This is the about page.", s, c });
});

app.post("/about", async (req, res) => {
  await delayResponse(50);
  const { s, c } = req.body;
  res.send({ message: "This is the about page.", s, c });
});

app.put("/about", (req, res) => {
  const { s, c } = req.body;
  res.send({ message: "This is the about page.", s, c });
});

app.get("/contact", (req, res) => {
  const { email, phone, subject } = req.query;
  res.send({ message: "This is the contact page.", email, phone, subject });
});

app.get("/login", (req, res) => {
  const { username, password } = req.query;
  res.send({ message: "success login", username, password });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  res.send({ message: "success login", username, password });
});

app.put("/login", (req, res) => {
  const { username, password } = req.body;
  res.send({ message: "success login", username, password });
});

app.delete("/login", (req, res) => {
  const { username, password } = req.body;
  res.send({ message: "success login", username, password });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Website server is running at http://localhost:${PORT}`);
});
