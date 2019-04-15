const express = require("express");
const port = require("./config");
const cors = require("cors");
const User = require("./models/user");
const Task = require("./models/task");
const sharp = require("sharp");
const multer = require("multer");
require("./config/mongoose");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/users", async (req, res) => {
  const user = new User(req.body);

  try {
    await user.save(); // save user
    res.status(201).send(user);
  } catch (e) {
    res.status(404).send(e.message);
  }
});

app.post("/users/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findByCredentials(email, password); // Function buatan sendiri
    res.status(200).send(user);
  } catch (e) {
    console.log(e, "Dari eror post db user and compare email dan pass ");

    res.status(404).send(e);
  }
});

app.post("/tasks/:userid", async (req, res) => {
  // Create tasks by user id
  try {
    const user = await User.findById(req.params.userid); // search user by id
    if (!user) {
      // jika user tidak ditemukan
      throw new Error("Unable to create task");
    }
    const task = new Task({ ...req.body, owner: user._id }); // membuat task dengan menyisipkan user id di kolom owner
    user.tasks = user.tasks.concat(task._id); // tambahkan id dari task yang dibuat ke dalam field 'tasks' user yg membuat task
    await task.save(); // save task
    await user.save(); // save user
    res.status(201).send(task);
  } catch (e) {
    res.status(404).send(e);
  }
});

// app.get("/tasks/:userid", async (req, res) => {
//   // mengambil data task dari db dengan params userid
//   try {
//     // find mengirim dalam bentuk array
//     const user = await User.find({ _id: req.params.userid })
//       .populate({ user })
//       .exec();
//     res.send(user);
//   } catch (e) {}
// });

// mengambil data task dari db dengan params userid
app.get("/tasks/:userid", async (req, res) => {
  try {
    // find mengirim dalam bentuk array
    const user = await User.find({ _id: req.params.userid })
      .populate({
        path: "tasks",
        options: { sort: { completed: "asc" } },
        limit: 10
      })
      .exec();
    res.send(user[0].tasks);
  } catch (e) {}
});

app.delete("/users/:userId/delete", async (req, res) => {
  // Delete user sekaligus dengan task nya
  const { userId } = req.params;

  try {
    await User.findOneAndDelete({ _id: userId }); // delet user findOneAndDelete berdasarkan userId
    await Task.deleteMany({ owner: userId }); // delet task berdasarkan userId yang di db task merupakan owner

    res.send("berhasil delete akun");
  } catch (e) {}
});

// app.delete("/tasks", async (req, res) => {
//   // Delete task
//   try {
//     const task = await Task.findOneAndDelete({ _id: req.body.taskid });

//     if (!task) {
//       res.status(400).send("failed to delete task");
//     }

//     const user = await User.findById(req.body.userid);
//     user.tasks = user.tasks.filter(t => t != req.body.taskid);
//     user.save();

//     res.sendStatus(200);

//     if (!newUser) {
//       return res.status(404).send("Delete failed on taks user");
//     }

//     res.status(200).send(newUser);
//   } catch (e) {
//     res.status(400).send(e);
//   }
// });

// app.delete("/tasks", async (req, res) => {
//   // Delete task
//   try {
//     const task = await Task.findOneAndDelete({ _id: req.body.id });
//     const user = await User.findOne({ _id: req.body.owner });

//     var taskDelete = user.tasks.filter(val => {
//       return val.toString() !== req.body.taskid;
//     });

//     user.tasks = taskDelete;
//     if (!taskDelete) {
//       return res.status(404).send("Delete failed");
//     }

//     await user.save();
//     res.status(200).send(task);
//   } catch (e) {
//     res.status(500).send(e);
//   }
// });

// // Delete task
app.delete("/tasks", async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.body.taskid });
    const user = await User.findOne({ _id: req.body.owner });
    console.log(user);

    if (!task) {
      return res.status(404).send("Delete failed");
    }

    user.tasks = await user.tasks.filter(val => val != req.body.taskid);
    user.save();
    console.log(user.tasks);

    res.status(200).send(task);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.patch("/tasks/:taskid/:userid", async (req, res) => {
  // untuk update data task di db
  const updates = Object.keys(req.body);
  const allowedUpdates = ["description", "completed"]; // yang akan di update
  const isValidOperation = updates.every(update =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ err: "Invalid request!" });
  }

  try {
    const task = await Task.findOne({
      _id: req.params.taskid,
      owner: req.params.userid
    });

    if (!task) {
      return res.status(404).send("Update Request");
    }

    updates.forEach(update => (task[update] = req.body[update]));
    await task.save();

    res.send("update berhasil");
  } catch (e) {}
});

app.patch("/users/avatar/:userid", async (req, res) => {
  // untuk update avatar/foto profil di db users
  const updates = Object.keys(req.body);
  const allowedUpdates = ["avatar"]; // yang akan di update
  const isValidOperation = updates.every(update =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ err: "Invalid request!" });
  }

  try {
    const user = await User.findOne({
      _id: req.params.userid
      //owner: req.params.userid
    });

    if (!user) {
      return res.status(404).send("Update Request");
    }

    updates.forEach(update => (user[update] = req.body[update]));
    await user.save();

    res.send(user);
  } catch (e) {}
});

app.patch("/users/:userid", async (req, res) => {
  // untuk update age, name dan email profil di db users
  const updates = Object.keys(req.body);
  const allowedUpdates = ["name", /*"email",*/ "age"]; // yang akan di update
  const isValidOperation = updates.every(update =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ err: "Invalid request!" });
  }

  try {
    const user = await User.findOne({
      _id: req.params.userid
      //owner: req.params.userid
    });

    if (!user) {
      return res.status(404).send("Update Request");
    }

    updates.forEach(update => (user[update] = req.body[update]));
    await user.save();

    res.send(user);
  } catch (e) {}
});

const upload = multer({
  // upload foto profile dengan module multer yang sudah di instal sebelumnya
  limits: {
    filesize: 1000000 // Byte max size
  },
  fileFilter(req, file, cb) {
    // urutanya harus benar
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      // RegEx
      // RegEx \ adalah membuat 'I\'m' terbaca , ' yg di tengah sebagai string biasa, $ adalah akhir, tidak ada lagi karakter setelahnya
      // // ditolak
      // cb(undefined, false)
      // throw error
      return cb(new Error("Please upload image file (jpg, jpeg, png)"));
    }
    // diterima
    cb(undefined, true);
  }
});

app.post("/users/:userid/avatar", upload.single("avatar"), async (req, res) => {
  // Link upload data
  // single adalah hanya menerima satu file saja dalam hal ini file gambar
  // Post image
  // upload.single('avatar') adalah fn untuk memeriksa jenis file, jika sudah lolos verif maka akan masuk ke req.file
  try {
    // console.log(req.file.buffer);
    // console.log(req.file);
    const buffer = await sharp(req.file.buffer)
      .resize({ width: 250 })
      .png()
      .toBuffer();
    const user = await User.findById(req.params.userid); // memeriksa userid di db
    if (!user) {
      // Jika user tidak ada
      throw Error("Unable to upload");
    }
    user.avatar = buffer;
    await user.save();
    res.send("Upload success");
  } catch (e) {
    res.send(e);
  }
});

app.get("/users/:userid/avatar", async (req, res) => {
  try {
    const user = await User.findById(req.params.userid); // mencari foto profile by Id dengan params userId di db

    if (!user || !user.avatar) {
      // jika tidak ada user yang cocok atau foto profile user tidak ada
      throw new Error("Not found");
    }
    res.set("Content-Type", "image/png"); // mengeset default konten yang asalnya objek json menjadi image
    res.send(user.avatar);
    res.render("index.html"); // rener index.html
  } catch (e) {
    res.send(e);
  }
});

app.listen(port, () => console.log("API Running on port " + port));

// app.get("/users/:userId", async (req, res) => {
//   try {
//     const user = await User.findById(req.params.userId);
//     if (!user) {
//       throw new Error("not found");
//     }
//     res.send(user.updatedAt);
//   } catch (e) {
//     res.send(e);
//   }
// });

// Tugas

// Back End
// 1. Update profile
// 2. Update tasks field when task deleted (filtering)
// 3. Delete avatar
// 4. Delete user
// 5. Delete all tasks when user deleted
// 6. Get own task, tambahkan fiutr Sorting, Match, limit. (populate)

// Front End
// Buat front end untuk semua fitur yang sudah dijelaskan plus yang menjadi tugas back end

// app.get("/users/:id", async (req, res) => {
//   // read one user by his id
//   // get one user by id
//   const _id = req.params.id; // destruct id

//   try {
//     const user = await User.findById(_id); // mongoose: Model.findById(id), result: found user

//     if (!user) {
//       // it will be empty if not found
//       return res.send(404).send(); // send error 404
//     }

//     res.status(200).send(user); // send the found user
//   } catch (e) {
//     res.status(500).send(); //status: internal server error
//   }
// });
