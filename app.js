const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const selectUserQuery = `SELECT 
    user.username, tweet.tweet, tweet.date_time AS dateTime
  FROM
    follower
  INNER JOIN tweet
    ON follower.following_user_id = tweet.user_id
  INNER JOIN user
    ON tweet.user_id = user.user_id
  WHERE 
    follower.follower_user_id = ${2}
  ORDER BY 
    tweet.date_time DESC
  LIMIT 4;`;
  const dbUser = await db.all(selectUserQuery);
  response.send(dbUser);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const selectUserQuery = `SELECT username FROM user JOIN follower WHERE user_id =follower_user_id ; `;
  const dbUser = await db.get(selectUserQuery);
  response.send(dbUser);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const selectUserQuery = `SELECT username FROM user JOIN follower WHERE user_id =follower_user_id ; `;
  const dbUser = await db.get(selectUserQuery);
  response.send(dbUser);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  try {
    const getBookQuery = `
      SELECT tweet,COUNT(user_id) AS likes,COUNT(user_id) AS replies,date_time AS dateTime FROM tweet  WHERE tweet_id=${tweetId};
    `;
    const book = await db.get(getBookQuery);
    response.send(book);
  } catch (e) {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    try {
      const getBookQuery = `
      SELECT username AS likes  FROM user JOIN like  WHERE tweet_id=${tweetId};
    `;
      const book = await db.get(getBookQuery);
      response.send(book);
    } catch (e) {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const getBookQuery = `
      SELECT username AS name ,reply  FROM user JOIN reply  WHERE tweet_id=${tweetId};
    `;
    const book = await db.get(getBookQuery);
    response.send(book);
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getBookQuery = `
      SELECT tweet ,count(like_id),count(reply_id)  FROM user NATURAL JOIN reply NATURAL JOIN like NATURAL JOIN tweet WHERE username=${username};
    `;
  const book = await db.get(getBookQuery);
  response.send(book);
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const createMoviesQuery = ` INSERT INTO tweet(tweet) 
    VALUES('${tweet}');`;
  const createQueryResponse = await db.run(createMoviesQuery);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    try {
      const deleteQuery = `
  DELETE FROM
    tweet
  WHERE
    tweet_id = ${tweetId};`;
      await database.run(deleteQuery);
      response.send("Tweet Removed");
    } catch (e) {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// User Register API
const validatePassword = (password) => {
  return password.length > 5;
};

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (username, name, password, gender)
     VALUES
      (
       '${username}',
       '${name}',
       '${hashedPassword}',
       '${gender}'  
      );`;
    if (validatePassword(password)) {
      await db.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
module.exports = app;
