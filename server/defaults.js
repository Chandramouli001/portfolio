// Runs on server start: if profile / interests / links are empty, fill them with the
// content that used to be hard-coded in the React file, so nothing disappears.
const { models, Profile } = require("./models");

const profile = {
  name: "Chandramouli Haldar",
  initials: "CH",
  title: "Student · Researcher · Innovator",
  subtitle: "Bridging Hardware & Software",
  location: "Kolkata, India",
  stats: [
    { value: "10+", label: "Publications" },
    { value: "3+", label: "Yrs Exp" },
    { value: "2", label: "Countries" },
  ],
  about: [
    "Chandramouli Haldar is an undergraduate researcher and technology professional from Kolkata, India, currently pursuing a **Bachelor of Technology in Computer Science & Engineering** at Maulana Abul Kalam Azad University of Technology (MAKAUT), West Bengal. His academic foundation is further reinforced by a **Diploma in Electronics & Telecommunication Engineering** from the West Bengal State Council of Technical Education — providing a rare dual perspective spanning both hardware and software disciplines.",
    "He gained significant international academic exposure through a research internship at the **Asian Institute of Technology (AIT), Bangkok, Thailand**, where he worked on innovation-focused projects involving geospatial data analysis, QGIS workflows, and real-world satellite datasets. This experience shaped his commitment to applied, impact-driven research.",
    "As **Founder and Chief Technology Officer of NovaTech Innovative Solutions**, Chandramouli leads engineering strategy and product development for smart infrastructure technologies. He also serves as **Junior Technical Faculty at Euphoria GenX**, mentoring students in database engineering, full-stack development, and hands-on MongoDB training.",
    "Beyond technology, he is an active learner of the Japanese language — inspired by Japan's thoughtful integration of centuries-old cultural heritage with world-leading technological innovation.",
  ],
};

const interests = [
  ["Artificial Intelligence & Machine Learning", "🧠"],
  ["IoT & Embedded Systems", "🔌"],
  ["Geospatial Data Science", "🌍"],
  ["Edge Computing", "⚡"],
  ["Human-Computer Interaction", "🖥️"],
  ["Database Engineering", "🗄️"],
  ["Smart Infrastructure", "🏙️"],
  ["Natural Language Processing", "💬"],
].map(([label, icon], i) => ({ label, icon, order: i }));

const links = [
  { label: "Chandramoulihaldar@gmail.com", url: "mailto:Chandramoulihaldar@gmail.com", icon: "✉", style: "" },
  { label: "chandramouli@novatech-is.in", url: "mailto:chandramouli@novatech-is.in", icon: "✉", style: "" },
  { label: "LinkedIn Profile", url: "https://www.linkedin.com/in/chandramouli01/", icon: "in", style: "li" },
  { label: "GitHub — Chandramouli001", url: "https://github.com/Chandramouli001", icon: "⌥", style: "" },
  { label: "YouTube Channel", url: "https://www.youtube.com/@Chandram0uli", icon: "▶", style: "" },
  { label: "Google Scholar", url: "https://scholar.google.com/citations?user=VXo1zqUAAAAJ&hl=en&oi=ao", icon: "🎓", style: "" },
  { label: "ORCID: 0009-0004-9759-194X", url: "https://orcid.org/0009-0004-9759-194X", icon: "iD", style: "orcid" },
  { label: "ResearchGate Profile", url: "https://www.researchgate.net/profile/Chandramouli-Haldar-4", icon: "RG", style: "rg" },
].map((l, i) => ({ ...l, order: i }));

async function ensureDefaults() {
  if (!(await Profile.countDocuments())) { await Profile.create(profile); console.log("Seeded default profile"); }
  if (!(await models.interests.countDocuments())) { await models.interests.insertMany(interests); console.log("Seeded interests"); }
  if (!(await models.links.countDocuments())) { await models.links.insertMany(links); console.log("Seeded links"); }
}

module.exports = { ensureDefaults };