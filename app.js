const multer = require("multer");
const path = require("path");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");
const twilio = require("twilio");

const app = express();
app.use(express.urlencoded());
const prisma = new PrismaClient();
const client = twilio(
  "ACef1b76c887299071d506b96b65ead92a",
  "a12bc192df57e2037a8c3b65fb1bac24"
);

app.use(cors());

app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.post("/api/gallery", upload.single("image"), async (req, res) => {
  const { title, description } = req.body;
  const image = `/uploads/${req.file.filename}`;

  try {
    const newGalleryItem = await prisma.gallery.create({
      data: {
        title,
        description,
        image,
      },
    });

    res.status(201).json(newGalleryItem);
  } catch (error) {
    console.error("Error adding gallery item:", error);
    res.status(500).json({ error: "Failed to add gallery item" });
  }
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/gallery", async (req, res) => {
  try {
    const gallery = await prisma.gallery.findMany();
    res.json(gallery);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch gallery items" });
  }
});

app.delete("/api/gallery/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.gallery.delete({
      where: { id },
    });
    res.status(200).json({ message: "Gallery item deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete gallery item" });
  }
});

app.put("/api/gallery/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  let image = req.body.image;

  if (req.file) {
    // If a new file is uploaded, use the new file's path
    image = `/uploads/${req.file.filename}`;
  }

  try {
    const updatedItem = await prisma.gallery.update({
      where: { id },
      data: {
        title,
        description,
        image, // Update the image if a new one is uploaded
      },
    });
    res.status(200).json(updatedItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update gallery item" });
  }
});

app.get("/api/schedule", async (req, res) => {
  try {
    const schedule = await prisma.schedule.findMany({
      include: { games: true },
    });
    res.json(schedule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
});

app.get("/api/schedule/games", async (req, res) => {
  try {
    const schedule = await prisma.game.findMany();
    res.json(schedule);
  } catch (error) {
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

/** PUT: Update an existing schedule by ID */
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
          deleteMany: {}, // Remove all existing games
          create: games, // Add new games
        },
      },
      include: { games: true },
    });
    res.json(updatedSchedule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

app.post("/api/schedule", async (req, res) => {
  const { day, time, description, games } = req.body;

  try {
    // Create a new schedule with associated games
    const newSchedule = await prisma.schedule.create({
      data: {
        day,
        time,
        description,
        games: {
          create: games, // Add associated games
        },
      },
      include: { games: true }, // Include games in the response
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
    await prisma.schedule.delete({
      where: { id },
    });
    res.status(204).send(); // No content
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

app.get("/api/waitlist", async (req, res) => {
  const waitlist = await prisma.waitlist.findMany();
  res.json(waitlist);
});

// Add to waitlist
app.post("/api/waitlist", async (req, res) => {
  const { firstName, lastInitial, phone, gameType, smsUpdates } = req.body;
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
  res.json(newEntry);
});

const verifiedNumbers = new Set();

// Trigger phone verification
// app.post("/api/verify", async (req, res) => {
//   console.log(req.body);
//   const { phoneNumber } = req.body;
//   try {
//     // Send SMS for verification
//     await client.messages.create({
//       body: "Your verification code is 1234.",
//       from: "+16478974271",
//       to: "+14372557675",
//     });

//     res.status(200).json({ message: "Verification triggered." });
//   } catch (error) {
//     console.error("Error triggering verification:", error);
//     res.status(500).json({ error: "Failed to trigger verification." });
//   }
// });

// Check verification status
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

// Save user to database
app.post("/api/waitlist", async (req, res) => {
  const { firstName, lastInitial, phoneNumber, gameType, smsUpdates } =
    req.body;

  try {
    const newUser = await prisma.waitlist.create({
      data: { firstName, lastInitial, phoneNumber, gameType, smsUpdates },
    });

    // Add phone number to verified list
    verifiedNumbers.add(phoneNumber);

    res.status(201).json(newUser);

    // Schedule auto-removal after 1 hour
    setTimeout(async () => {
      await prisma.waitlist.delete({ where: { phoneNumber } });
      verifiedNumbers.delete(phoneNumber);
    }, 3600000); // 1 hour in milliseconds
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({ error: "Failed to save user." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
