window.portfolioData = {
  profile: {
    name: "Dhruv Garg",
    heroKicker: "Curious, disciplined, and quietly ambitious",
    role: "Third-Year Student | AI, ML, and Deep Learning",
    headline: "I build AI systems by staying consistent, experimental, and practical.",
    summary:
      "I am a third-year college student balancing academics with focused AI practice. Python is my core language, and I spend most of my best hours in Colab training models, debugging loss curves, and visualizing results.",
    projectsDescription:
      "A mix of predictive ML, computer vision, and generative experiments that show how my work is evolving from fundamentals to deployed systems.",
    skillsDescription:
      "My growth pattern is simple: strong ML foundations, disciplined experimentation, and gradual expansion into full-stack, cloud, and DevOps.",
    journeyDescription:
      "From regression baselines to deployed creative ML systems, each phase added one layer of rigor, one layer of engineering, and one layer of real-world relevance.",
    contactKicker: "Collaborate",
    contactTitle: "I am looking for meaningful AI internships and research work.",
    contactCopy:
      "If your team values consistency, curiosity, and practical ML execution, I would love to contribute. Email is the fastest way to reach me.",
    identityHighlights: [
      { label: "Mindset", value: "Curious, disciplined, quietly ambitious." },
      { label: "Current Stage", value: "Third-year college student building technical depth." },
      { label: "Primary Playground", value: "Python, PyTorch, and Google Colab." }
    ],
    nowLearning: [
      "Full-stack foundations for model-backed applications",
      "Cloud deployment patterns and environment setup",
      "DevOps habits for reproducible and reliable delivery"
    ],
    personalNote:
      "Outside coursework, I spend time learning independently, breaking down complex ideas, and refining long-term goals.",
    email: "xyz156076@gmail.com",
    github: "https://github.com/DhruvGarg111",
    huggingFace: "https://huggingface.co/spaces/DhruvGarg111/Style-Transfer"
  },
  tones: {
    technical: {
      heroHeadline: "I build AI systems by staying consistent, experimental, and practical.",
      heroSummary:
        "I focus on PyTorch-first model development with disciplined iteration in Colab. My work spans predictive ML, depth estimation, style transfer, and generation while increasingly integrating product and systems thinking.",
      projectsDescription:
        "Project briefs focused on architecture choices, training decisions, and how experimentation translated into usable outputs.",
      skillsDescription:
        "Applied strengths across model development, reproducibility, and deployment-aware engineering.",
      contactTitle: "I am looking for meaningful AI internships and research work.",
      contactCopy:
        "I can contribute across model prototyping, experimentation workflows, and product-oriented ML execution."
    },
    recruiter: {
      heroHeadline: "A student engineer turning AI curiosity into real projects.",
      heroSummary:
        "I am a third-year student with a strong Python and AI foundation, growing from core ML projects into deployable systems and end-to-end engineering skills.",
      projectsDescription:
        "Selected work that demonstrates initiative, disciplined learning, and measurable technical progress.",
      skillsDescription:
        "Strong in ML fundamentals, fast with Python tooling, and actively expanding into full-stack, cloud, and DevOps.",
      contactTitle: "Available for AI/ML internships and research collaboration.",
      contactCopy:
        "I am ready to support a team that ships practical AI products and values ownership-driven learning."
    }
  },
  heroStats: [
    { label: "01 / Stage", value: "Third-Year Undergraduate" },
    { label: "02 / Daily Flow", value: "Python + Colab + Experiments" },
    { label: "03 / Core Direction", value: "AI, ML, and Deep Learning" },
    { label: "04 / Working Style", value: "Steady, curious, disciplined" }
  ],
  journey: [
    {
      phase: "01 / Foundation",
      title: "Built confidence with predictive ML",
      detail:
        "Started with house price and insurance prediction projects to build disciplined habits around feature prep, training loops, and evaluation."
    },
    {
      phase: "02 / Vision Shift",
      title: "Moved into deeper computer vision",
      detail:
        "Transitioned into depth estimation and representation-focused work, where architecture decisions and data quality mattered more than quick benchmarks."
    },
    {
      phase: "03 / Creative Modeling",
      title: "Explored GAN-based image generation",
      detail:
        "Used generative experiments to understand instability, training dynamics, and the balance between visual quality and controllability."
    },
    {
      phase: "04 / Product Mindset",
      title: "Built and deployed Neural Canvas",
      detail:
        "Trained a fast neural style transfer model in PyTorch and deployed it on Hugging Face to create a usable, real-time creative tool."
    },
    {
      phase: "05 / Systems Growth",
      title: "Expanding beyond model-only thinking",
      detail:
        "Now investing in full-stack development, cloud deployment, and DevOps workflows to build complete, end-to-end AI systems."
    }
  ],
  projects: [
    {
      id: "searchlight-protocol",
      name: "The Searchlight Protocol",
      repoUrl: "https://github.com/DhruvGarg111/The-Searchlight-Protocol",
      maturity: "Research Prototype",
      purpose:
        "Coarse-to-fine aerial forensics pipeline for small-object detection in 2K/4K imagery using LayerCAM-guided slicing.",
      outcome: "Reduced unnecessary compute while preserving detection sensitivity.",
      stack: ["YOLOv8/v9", "LayerCAM", "ResNet-50", "Adaptive Slicing", "OpenCV"]
    },
    {
      id: "pygog-cli",
      name: "pygog",
      repoUrl: "https://github.com/DhruvGarg111/py-goog-cli",
      maturity: "Developer Tool",
      purpose:
        "CLI and agentic interface for Google Workspace automation with composable commands and natural-language task orchestration.",
      outcome: "Built as an end-to-end productivity tool with secure OAuth2 workflows and practical API integration.",
      stack: ["Python", "Typer", "OAuth2", "LiteLLM", "Rich"]
    },
    {
      id: "neural-canvas",
      name: "Neural Canvas",
      repoUrl: "https://github.com/DhruvGarg111/Neural-Style-Transfer",
      maturity: "Deployed Favorite",
      purpose:
        "Fast feed-forward style transfer pipeline trained with perceptual loss in PyTorch and optimized for interactive inference.",
      outcome: "Deployed on Hugging Face for practical real-time use and iteration.",
      stack: ["PyTorch", "Gradio", "VGG-16", "Residual Blocks", "CUDA"]
    },
    {
      id: "depth-estimation",
      name: "Depth Completion",
      repoUrl: "https://github.com/DhruvGarg111/Depth-Estimation-with-Semantic-Segmentation",
      maturity: "Advanced Vision",
      purpose:
        "Multi-modal depth prediction by fusing RGB input, sparse depth cues, and semantic guidance into a supervised encoder-decoder setup.",
      outcome: "Strengthened my understanding of fusion design and supervision strategy tradeoffs.",
      stack: ["U-Net", "NYU Depth v2", "Multimodal Fusion", "PyTorch", "GroupNorm"]
    }
  ],
  skills: [
    {
      area: "Model Building Discipline",
      summary: "I enjoy iterating on architectures with clear hypotheses and measurable outcomes.",
      tools: [
        "PyTorch and Torchvision",
        "CNN and Transformer Architectures",
        "Depth and Multi-Modal Modeling",
        "Loss Function Debugging",
        "Experiment-Driven Iteration"
      ]
    },
    {
      area: "Creative + Applied AI",
      summary: "I like projects where engineering rigor and creative output meet.",
      tools: [
        "Neural Style Transfer",
        "GAN Experimentation",
        "Perceptual Loss Training",
        "Inference Optimization",
        "Interactive Demo Deployment"
      ]
    },
    {
      area: "Systems Expansion",
      summary: "I am actively moving from model-first work to complete product delivery.",
      tools: [
        "Modular Python Design",
        "API and CLI Thinking",
        "Containerization Basics",
        "Cloud Learning Path",
        "DevOps Fundamentals in Progress"
      ]
    }
  ],
  techStack: [
    { name: "Python", icon: "devicon-python-plain" },
    { name: "PyTorch", icon: "devicon-pytorch-plain" },
    { name: "NumPy", icon: "devicon-numpy-plain" },
    { name: "Pandas", icon: "devicon-pandas-plain" },
    { name: "Matplotlib", icon: "devicon-matplotlib-plain" },
    { name: "Scikit-learn", icon: "devicon-scikitlearn-plain" },
    { name: "TensorFlow", icon: "devicon-tensorflow-original" },
    { name: "OpenCV", icon: "devicon-opencv-plain" },
    { name: "Jupyter", icon: "devicon-jupyter-plain" },
    { name: "Google Colab", icon: "devicon-googlecolab-plain" },
    { name: "FastAPI", icon: "devicon-fastapi-plain" },
    { name: "Docker", icon: "devicon-docker-plain" },
    { name: "Git", icon: "devicon-git-plain" },
    { name: "GitHub", icon: "devicon-github-original" },
    { name: "HTML5", icon: "devicon-html5-plain" },
    { name: "CSS3", icon: "devicon-css3-plain" },
    { name: "JavaScript", icon: "devicon-javascript-plain" },
    { name: "Java", icon: "devicon-java-plain" },
    { name: "C", icon: "devicon-c-plain" },
    { name: "VS Code", icon: "devicon-vscode-plain" },
    { name: "Hugging Face", icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.025 1.13c-5.77 0-10.449 4.647-10.449 10.378 0 1.112.178 2.181.503 3.185.064-.222.203-.444.416-.577a.96.96 0 0 1 .524-.15c.293 0 .584.124.84.284.278.173.48.408.71.694.226.282.458.611.684.951v-.014c.017-.324.106-.622.264-.874s.403-.487.762-.543c.3-.047.596.06.787.203s.31.313.4.467c.15.257.212.468.233.542.01.026.653 1.552 1.657 2.54.616.605 1.01 1.223 1.082 1.912.055.537-.096 1.059-.38 1.572.637.121 1.294.187 1.967.187.657 0 1.298-.063 1.921-.178-.287-.517-.44-1.041-.384-1.581.07-.69.465-1.307 1.081-1.913 1.004-.987 1.647-2.513 1.657-2.539.021-.074.083-.285.233-.542.09-.154.208-.323.4-.467a1.08 1.08 0 0 1 .787-.203c.359.056.604.29.762.543s.247.55.265.874v.015c.225-.34.457-.67.683-.952.23-.286.432-.52.71-.694.257-.16.547-.284.84-.285a.97.97 0 0 1 .524.151c.228.143.373.388.43.625l.006.04a10.3 10.3 0 0 0 .534-3.273c0-5.731-4.678-10.378-10.449-10.378M8.327 6.583a1.5 1.5 0 0 1 .713.174 1.487 1.487 0 0 1 .617 2.013c-.183.343-.762-.214-1.102-.094-.38.134-.532.914-.917.71a1.487 1.487 0 0 1 .69-2.803m7.486 0a1.487 1.487 0 0 1 .689 2.803c-.385.204-.536-.576-.916-.71-.34-.12-.92.437-1.103.094a1.487 1.487 0 0 1 .617-2.013 1.5 1.5 0 0 1 .713-.174m-10.68 1.55a.96.96 0 1 1 0 1.921.96.96 0 0 1 0-1.92m13.838 0a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92M8.489 11.458c.588.01 1.965 1.157 3.572 1.164 1.607-.007 2.984-1.155 3.572-1.164.196-.003.305.12.305.454 0 .886-.424 2.328-1.563 3.202-.22-.756-1.396-1.366-1.63-1.32q-.011.001-.02.006l-.044.026-.01.008-.03.024q-.018.017-.035.036l-.032.04a1 1 0 0 0-.058.09l-.014.025q-.049.088-.11.19a1 1 0 0 1-.083.116 1.2 1.2 0 0 1-.173.18q-.035.029-.075.058a1.3 1.3 0 0 1-.251-.243 1 1 0 0 1-.076-.107c-.124-.193-.177-.363-.337-.444-.034-.016-.104-.008-.2.022q-.094.03-.216.087-.06.028-.125.063l-.13.074q-.067.04-.136.086a3 3 0 0 0-.135.096 3 3 0 0 0-.26.219 2 2 0 0 0-.12.121 2 2 0 0 0-.106.128l-.002.002a2 2 0 0 0-.09.132l-.001.001a1.2 1.2 0 0 0-.105.212q-.013.036-.024.073c-1.139-.875-1.563-2.317-1.563-3.203 0-.334.109-.457.305-.454m.836 10.354c.824-1.19.766-2.082-.365-3.194-1.13-1.112-1.789-2.738-1.789-2.738s-.246-.945-.806-.858-.97 1.499.202 2.362c1.173.864-.233 1.45-.685.64-.45-.812-1.683-2.896-2.322-3.295s-1.089-.175-.938.647 2.822 2.813 2.562 3.244-1.176-.506-1.176-.506-2.866-2.567-3.49-1.898.473 1.23 2.037 2.16c1.564.932 1.686 1.178 1.464 1.53s-3.675-2.511-4-1.297c-.323 1.214 3.524 1.567 3.287 2.405-.238.839-2.71-1.587-3.216-.642-.506.946 3.49 2.056 3.522 2.064-1.29.33-4.568 1.028-5.713-.624m5.349 0c-.824-1.19-.766-2.082.365-3.194 1.13-1.112 1.789-2.738 1.789-2.738s.246-.945.806-.858.97 1.499-.202 2.362c-1.173.864.233 1.45.685.64.451-.812 1.683-2.896 2.322-3.295s1.089-.175.938.647-2.822 2.813-2.562 3.244 1.176-.506 1.176-.506 2.866-2.567 3.49-1.898-.473 1.23-2.037 2.16c-1.564.932-1.686 1.178-1.464 1.53s3.675-2.511 4-1.297c.323 1.214-3.524 1.567-3.287 2.405.238.839 2.71-1.587 3.216-.642.506.946-3.49 2.056-3.522 2.064-1.29.33-4.568 1.028-5.713-.624"/></svg>` },
    { name: "PyTorch Lightning", icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>` }
  ]
};
