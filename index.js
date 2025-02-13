const multer = require("multer");
const path = require("path");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public"))); // Serve static files (if you have a 'public' folder)
const serverUrl = "https://eliteclub-api.onrender.com";
// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, "uploads");
const fs = require("fs"); // Import the file system module
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir); // Use the 'uploadsDir' variable
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage });

// Routes

app.get("/", (req, res) => {
  res.send("Hello");
});

// Gallery Routes
app.get("/api/gallery", async (req, res) => {
  try {
    const gallery = await prisma.gallery.findMany();
    res.json(gallery);
  } catch (error) {
    console.error("Error fetching gallery items:", error);
    res.status(500).json({ error: "Failed to fetch gallery items" });
  }
});

app.post("/api/gallery", upload.single("image"), async (req, res) => {
  const { title, description } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }
  const image = `${serverUrl}/uploads/${req.file.filename}`;
  console.log(image);
  try {
    const newGalleryItem = await prisma.gallery.create({
      data: { title, description, image },
    });
    res.status(201).json(newGalleryItem);
  } catch (error) {
    console.error("Error adding gallery item:", error);
    res.status(500).json({ error: "Failed to add gallery item" });
  }
});

app.put("/api/gallery/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  let image;

  if (req.file) {
    image = `/uploads/${req.file.filename}`;
  } else if (req.body.image) {
    image = req.body.image;
  } else {
    return res.status(400).json({ error: "No image provided" });
  }

  try {
    const updatedItem = await prisma.gallery.update({
      where: { id },
      data: { title, description, image },
    });
    res.json(updatedItem);
  } catch (error) {
    console.error("Error updating gallery item:", error);
    res.status(500).json({ error: "Failed to update gallery item" });
  }
});

app.delete("/api/gallery/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.gallery.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting gallery item:", error);
    res.status(500).json({ error: "Failed to delete gallery item" });
  }
});

// Schedule Routes
app.get("/api/schedule", async (req, res) => {
  try {
    const schedule = await prisma.schedule.findMany({
      include: { games: true },
    });
    res.json(schedule);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
});

app.get("/api/schedule/games", async (req, res) => {
  try {
    const games = await prisma.game.findMany();
    res.json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

app.get("/api/schedule/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: { games: true },
    });
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json(schedule);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

app.put("/api/schedule/:id", async (req, res) => {
  const { id } = req.params;
  const { day, time, description, games } = req.body;
  try {
    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: {
        day,
        time,
        description,
        games: {
          deleteMany: {},
          create: games,
        },
      },
      include: { games: true },
    });
    res.json(updatedSchedule);
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

app.post("/api/schedule", async (req, res) => {
  const { day, time, description, games } = req.body;
  try {
    const newSchedule = await prisma.schedule.create({
      data: {
        day,
        time,
        description,
        games: {
          create: games,
        },
      },
      include: { games: true },
    });
    res.status(201).json(newSchedule);
  } catch (error) {
    console.error("Error adding schedule:", error);
    res.status(500).json({ error: "Failed to add schedule" });
  }
});

app.delete("/api/schedule/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.schedule.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting schedule:", error);
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

// Waitlist Routes
app.get("/api/waitlist", async (req, res) => {
  try {
    const waitlist = await prisma.waitlist.findMany();
    res.json(waitlist);
  } catch (error) {
    console.error("Error getting waitlist:", error);
    res.status(500).json({ error: "Failed to get waitlist" });
  }
});

app.post("/api/waitlist", async (req, res) => {
  const { firstName, lastInitial, phone, gameType, smsUpdates } = req.body;
  try {
    const newEntry = await prisma.waitlist.create({
      data: {
        firstName,
        lastInitial,
        phone,
        gameType,
        smsUpdates,
        checkedIn: false,
      },
    });
    res.status(201).json(newEntry);
  } catch (error) {
    console.error("Error adding to waitlist:", error);
    res.status(500).json({ error: "Failed to add to waitlist" });
  }
});

// ... (Verification routes - these need careful review and probably a proper SMS service integration)
app.get("/api/verify/:phone", async (req, res) => {
  const { phone } = req.params;

  const user = await prisma.user.findUnique({
    where: { phone },
  });
  if (!user) {
    res.json({ user: false });
  } else {
    res.json({ user: true });
  }
});
// Start Server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
