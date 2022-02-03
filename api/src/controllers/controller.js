import mongoose from "mongoose";
const { model } = mongoose;
const task = model("Users");

export function listUsers(req, res) {
  task.find({}, (err, task) => {
    if (err) res.send(err);
    res.json(task);
  });
}

export function createUser(req, res) {
  const new_task = new task(req.body);
  new_task.save((err, task) => {
    if (err) res.send(err);
    res.json(task);
  });
}

export function readUser(req, res) {
  task.findById(req.params.taskId, (err, task) => {
    if (err) res.send(err);
    res.json(task);
  });
}

export function updateUser(req, res) {
  task.findOneAndUpdate(
    { _id: req.params.taskId },
    req.body,
    { new: true },
    (err, task) => {
      if (err) res.send(err);
      res.json(task);
    }
  );
}

export function deleteUser(req, res) {
  task.remove(
    {
      _id: req.params.taskId,
    },
    (err, task) => {
      if (err) res.send(err);
      res.json({ message: "Task deleted" });
    }
  );
}
