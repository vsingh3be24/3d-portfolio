export const profile = {
  name: "Vaishnavi Singh",
  role: "Computer Engineering Student",
  place: "Thapar Institute, Patiala",
  batch: "Batch of 2028",
  pitch:
    "I build internal tools and full-stack applications that automate business processes, from requirements and schema design to APIs, models and deployment. Looking for Application Engineering internships.",
  // The About section below the hero, one paragraph per entry.
  about: [
    "I'm a Computer Engineering undergraduate at Thapar Institute of Engineering and Technology, graduating in 2028, with an 8.82 CGPA and a strong base in data structures and algorithms: 140+ LeetCode problems and a 1540 contest rating.",
    "I build custom front-end and back-end applications with Java, the MERN stack, Python and Flask, and SQL, and most of them are internal tools that automate a business process. I enjoy translating business requirements into technical solutions, and the work that makes them dependable: RESTful APIs, database design, third-party integrations, testing and troubleshooting.",
  ],
  email: "vaishnavixthapar@gmail.com",
  // Her resume lists github.com/vaishnavi-singh, which is a different, empty
  // account; this is the one with her projects.
  github: "https://github.com/vsingh3be24",
  linkedin: "https://linkedin.com/in/vaishnavi-singh",
  leetcode: "https://leetcode.com/u/vaishnavi-singh",
  // Served from public/. Linked from the destination list as "My resume".
  resume: "/resume.pdf",
  // Bottom right, beside a small accent dot.
  location: "Patiala, India",
  skills: [
    { label: "Languages", items: ["C++", "Java", "Python", "JavaScript (ES6+)", "TypeScript", "SQL", "C"] },
    {
      label: "Web",
      items: [
        "React",
        "Node.js",
        "Express",
        "Flask",
        "HTML5",
        "CSS3",
        "RESTful web services",
        "Microservices",
        "JWT authentication",
        "Role-based access control",
      ],
    },
    { label: "Databases", items: ["MySQL", "MongoDB", "Mongoose", "Schema design", "Query optimization"] },
    {
      label: "Data & ML",
      items: [
        "Pandas",
        "NumPy",
        "scikit-learn",
        "Matplotlib",
        "Feature engineering",
        "Logistic Regression",
        "TF-IDF",
        "Model evaluation",
      ],
    },
    {
      label: "Tools",
      items: ["Git", "GitHub Actions", "Postman", "Jest", "VS Code", "Jupyter", "Agile / Scrum"],
    },
  ],
  timeline: [
    { year: "2024", label: "95.24 percentile in JEE Mains" },
    { year: "Aug 2024", label: "Started B.Tech at Thapar Institute" },
    { year: "Sep 2024", label: "Alumni cell coordinator and FAPS member" },
    { year: "2024", label: "Best Speaker, Model United Nations Society" },
    { year: "Aug 2025", label: "Student Placement Representative and Proctor, Vahini Hall" },
    { year: "2026", label: "Semifinalist, Flipkart GRID 8.0 Software Development Challenge" },
  ],
  stats: [
    { label: "LeetCode problems solved", value: "140+" },
    { label: "Contest rating", value: "1540" },
    { label: "CGPA", value: "8.82" },
  ],
} as const
