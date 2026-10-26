SHAREMART - Secure Online Shopping System with Escrow Payments and Shared Marketing Rewards
===========================================================================================

WHAT IS IN THIS FOLDER
  index.html, product.html, cart.html, login.html, about.html, contact.html, privacy.html,
  marketer.html, seller.html, admin.html     the ten pages (each one just starts app.js)
  app.js                                      all the website logic (organised in 12 labelled sections)
  style.css                                   design, animation and the phone layout (three-dot menu)
  images/                                     product photos (product-1.jpg ... product-5.jpg)
  netlify/functions/api.mjs                   the shared server (Netlify Function + Netlify Blobs)
  netlify.toml, package.json                  Netlify settings and the one dependency (@netlify/blobs)
  dev-server.mjs                              runs the whole site + server on your computer for testing
  database/schema.sql                         reference MySQL design (the live site uses Netlify Blobs)

HOW IT WORKS
  * On Netlify (or with dev-server.mjs) every visitor loads the SAME data from the shared server, so a
    product a seller lists, edits or removes is visible to everybody, on every phone and computer.
  * If the server cannot be reached (for example you double-click index.html) the site still works
    in "browser-only" mode and keeps its data in that one browser.
  * Passwords are stored on the server as salted hashes. Payouts are calculated on the server.

PUT IT ON GITHUB AND NETLIFY
  1. Put every file in this folder at the ROOT of your GitHub repository (index.html must be at the root,
     with the netlify folder beside it). Commit and push.
  2. Netlify > Add new site > Import an existing project > GitHub > choose the repository.
       Build command : (leave empty)
       Publish directory : .   (a single dot)
       Functions directory : netlify/functions   (already set in netlify.toml)
     If the files are inside a sub-folder of the repository, set that folder as the Base directory.
  3. Netlify > Site configuration > Environment variables > add  ADMIN_PASSWORD  = a password of your choice.
     (It becomes the administrator password the first time the site starts. The password shown in the
     report/demo, admin123, is then NOT valid on the live site.)
  4. Deploy. Open the site: the first visit stores the starter users and products in Netlify Blobs.
  5. Every later "git push" deploys automatically. The stored data is kept between deployments.
  To start again with empty data: Netlify > Blobs > delete the store named "sharemart".

DEMO ACCOUNTS (starter data)
  seller@sharemart.ng / seller123      marketer@sharemart.ng / market123      buyer@sharemart.ng / buyer123
  admin@sharemart.ng  / admin123  (or the ADMIN_PASSWORD you set)

TEST ON YOUR COMPUTER (needs Node.js 18 or newer, no installation of packages)
  node dev-server.mjs        then open  http://localhost:8888
  The test data is kept in a folder called .data (delete the folder to start again).
  Or use the Netlify CLI:  npm i -g netlify-cli   then   netlify dev
