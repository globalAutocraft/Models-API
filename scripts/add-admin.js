// Approves a Google account to edit the catalogue from the admin website.
// Usage: npm run add-admin -- service-account.json someone@gmail.com
//        npm run add-admin -- service-account.json someone@gmail.com --remove
const { connect } = require("../firebase");

async function main() {
  const [keyFile, email, flag] = process.argv.slice(2);
  if (!email || !email.includes("@")) throw new Error("Usage: npm run add-admin -- service-account.json someone@gmail.com [--remove]");
  const ref = connect(keyFile).collection("admins").doc(email.toLowerCase());
  if (flag === "--remove") {
    await ref.delete();
    console.log(`Removed ${email.toLowerCase()} from admins`);
  } else {
    await ref.set({ email: email.toLowerCase(), addedAt: new Date() });
    console.log(`${email.toLowerCase()} can now edit the catalogue`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
