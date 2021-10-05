const path = require("path");
const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server is running at http://localhost:3000/`);
    });
  } catch (e) {
    console.log(`DBError: ${e.message}`);
  }
};
initializeDbAndServer();

// 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = bcrypt.hash(password, 10);
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponse = await db.get(getUserQuery);
  if (dbResponse !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    const addUserQuery = `
        INSERT INTO user (username, password, name, gender)
      VALUES (
          '${username}', '${password}', '${name}', '${gender}'
      );
    `;
    const addUser = await db.run(addUserQuery);
    if (password.length > 6) {
      await db.run(addUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      await db.run(addUserQuery);
      response.status(400);
      response.send("Password is too short");
    }
  }
});

// 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponse = await db.get(selectUserQuery);
  let jwtToken;
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = bcrypt.compare(dbResponse.password, password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      jwtToken = await bcrypt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Authentication JWT Token
const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader[1];
  }
  if (authHeader === undefined) {
    response.status(400);
    response.status("Invalid JWT Token");
  } else {
    jwtToken = await bcrypt.verify(
      jwtToken,
      "MY_SECRET_TOKEN",
      (error, payload) => {
        if (error) {
          response.status(400);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      }
    );
  }
};

// 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getTweetsQuery = `
        SELECT
            username, tweet, date_time as dateTime
        FROM
            user INNER JOIN tweet ON user.user_id = tweet.user_id
        WHERE tweet.user_id IN (
            SELECT following_user_id FROM follower;
        )
        ORDER BY tweet.date_time DESC
        LIMIT 4;
    `;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});
