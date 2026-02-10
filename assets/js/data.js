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
  ]
};
