import express from 'express'
import session from 'express-session'
import { WorkOS } from '@workos-inc/node'

const app = express()
const router = express.Router()
// const port = 8000;

app.use(
    session({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: true },
    })
)

const workos = new WorkOS(process.env.WORKOS_API_KEY)
const clientID = process.env.WORKOS_CLIENT_ID
const organizationID = 'org_01JYZ8AZ7EQZV3HHN72E6Z4KE4'
const directoryID = "directory_01JYZEXJPKDD7GSWZ4HE9H4HJV";
const redirectURI = 'http://localhost:8000/callback'
const state = ''


router.get('/', function (req, res) {
    if (session.isloggedin) {
        res.render('login_successful.ejs', {
            profile: session.profile,
            first_name: session.first_name,
        })
    } else {
        res.render('index.ejs', { title: 'Home' })
    }
})

router.post('/login', (req, res) => {
    const login_type = req.body.login_method

    const params = {
        clientID: clientID,
        redirectURI: redirectURI,
        state: state,
    }

    if (login_type === 'saml') {
        params.organization = organizationID
    } else {
        params.provider = login_type
    }

    try {
        const url = workos.sso.getAuthorizationURL(params)

        res.redirect(url)
    } catch (error) {
        res.render('error.ejs', { error: error })
    }
})


router.get('/callback', async (req, res) => {
    let errorMessage;
    try {
        const { code, error } = req.query;

        if (error) {
            errorMessage = `Redirect callback error: ${error}`;
        } else {
            const profile = await workos.sso.getProfileAndToken({
                code,
                clientID,
            });

            const json_profile = JSON.stringify(profile, null, 4);

            session.first_name = profile.profile.first_name;
            session.last_name = profile.profile.last_name;
            session.profile = json_profile;
            session.isloggedin = true;
        }
    } catch (error) {
        errorMessage = `Error exchanging code for profile: ${error}`;
    }

    if (errorMessage) {
        res.render('error.ejs', { error: errorMessage });
    } else {
        res.send(`
            <html>
                <head>
                    <title>Welcome to Rex App</title>
                    <style>
                        body {
                            margin: 0;
                            height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-family: sans-serif;
                            background-color: #fefefe;
                        }
                        .container {
                            text-align: center;
                        }
                        img {
                            max-width: 200px;
                            margin-bottom: 20px;
                        }
                        input[type="button"] {
                            padding: 10px 20px;
                            font-size: 16px;
                            border: none;
                            background-color: coral;
                            color: white;
                            border-radius: 8px;
                            cursor: pointer;
                        }
                        input[type="button"]:hover {
                            background-color: #e6735f;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <img src="https://www.freepng.com/uploads/images/202311/cartoon-dinosaur-png--red-dinosaur-cartoon-cute-vector_1020x-3703.jpg" alt="Cute Dinosaur" />
                        <h1>Welcome to Rex App, ${session.first_name} ${session.last_name}!</h1>
                        <p>Click on the button below to see a list of users in the directory.</p>
                        <input type="button" onclick="location.href='http://localhost:8000/directory-users';" value="Directory List" />
                    </div>
                </body>
            </html>
        `);
    }
});


router.get("/directory-users", async (req, res) => {
  try {
    let users = [];
    let hasMore = true;
    let after = undefined;

    while (hasMore) {
      const { data: directoryUsers, listMetadata } =
        await workos.directorySync.listUsers({
          directory: directoryID,
          after,
        });

      for (const user of directoryUsers) {
        const firstName = user.first_name || "";
        const lastName = user.last_name || "";
        const displayName = (firstName + " " + lastName).trim() || user.username || user.id;
        users.push(displayName);
      }

      hasMore = listMetadata.has_more;
      after = listMetadata.after;
    }

  res.send(`
      <html>
        <head>
          <title>Directory Users</title>
          <style>
            body {
              font-family: sans-serif;
              background-color: #fdfdfd;
              padding: 40px;
              text-align: center;
            }
            h1 {
              margin-bottom: 20px;
              font-size: 2.5em;
              color: #333;
            }
            ul {
              list-style-type: none;
              padding: 0;
              margin: 20px 0;
            }
            li {
              padding: 8px;
              font-size: 18px;
            }
            button {
              margin-top: 20px;
              padding: 10px 20px;
              font-size: 16px;
              background-color: coral;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
            }
            button:hover {
              background-color: #e6735f;
            }
          </style>
        </head>
        <body>
          <h1>Directory Users</h1>
          <ul>
            ${users.map(name => `<li>${name}</li>`).join('')}
          </ul>
          <button onclick="window.history.back()">⬅ Back</button>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error fetching directory users:", error);
    res.status(500).send("Error fetching directory users.");
  }
});


router.get('/logout', async (req, res) => {
    try {
        session.first_name = null
        session.profile = null
        session.isloggedin = null

        res.redirect('/')
    } catch (error) {
        res.render('error.ejs', { error: error })
    }
})

export default router
