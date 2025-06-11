import { Client } from "@notionhq/client";
import { notion, NOTION_PAGE_ID, createDatabaseIfNotExists, findDatabaseByTitle } from "./notion";

// Environment variables validation
if (!process.env.NOTION_INTEGRATION_SECRET) {
    throw new Error("NOTION_INTEGRATION_SECRET is not defined. Please add it to your environment variables.");
}

// Example function to setup databases for a tasks application
async function setupNotionDatabases() {
    await createDatabaseIfNotExists("Tasks", {
        // Every database needs a Name/Title property
        Title: {
            title: {}
        },
        Description: {
            rich_text: {}
        },
        Section: {
            select: {
                options: [
                    { name: "Getting Started", color: "blue" },
                    { name: "Account Setup", color: "green" },
                    { name: "Documentation", color: "orange" },
                    { name: "Training", color: "purple" },
                    { name: "Uncategorized", color: "gray" }
                ]
            }
        },
        Completed: {
            checkbox: {}
        },
        DueDate: {
            date: {}
        },
        CompletedAt: {
            date: {}
        },
        Priority: {
            select: {
                options: [
                    { name: "High", color: "red" },
                    { name: "Medium", color: "yellow" },
                    { name: "Low", color: "green" }
                ]
            }
        },
        Status: {
            select: {
                options: [
                    { name: "To Do", color: "gray" },
                    { name: "In Progress", color: "blue" },
                    { name: "Done", color: "green" },
                    { name: "Blocked", color: "red" }
                ]
            }
        }
    });

}

async function createSampleData() {
    try {
        console.log("Adding sample data...");

        // Find the databases again
        const tasksDb = await findDatabaseByTitle("Tasks");

        if (!tasksDb) {
            throw new Error("Could not find the required databases.");
        }

        const tasks = [
            {
                title: "Complete onboarding questionnaire",
                description: "Fill out the initial questionnaire to help us understand your needs better.",
                section: "Getting Started",
                priority: "High"
            },
            {
                title: "Schedule kickoff meeting",
                description: "Set up a time for the initial project kickoff meeting with your account manager.",
                section: "Getting Started",
                priority: "High"
            },
            {
                title: "Set up user accounts",
                description: "Create user accounts for all team members who need access to the platform.",
                section: "Account Setup",
                priority: "Medium"
            },
            {
                title: "Configure notification preferences",
                description: "Set up your notification preferences for updates and alerts.",
                section: "Account Setup",
                priority: "Low"
            },
            {
                title: "Review documentation",
                description: "Go through the platform documentation to understand all available features.",
                section: "Documentation",
                priority: "Medium"
            },
            {
                title: "Attend training session",
                description: "Participate in the scheduled training session for your team.",
                section: "Training",
                priority: "High"
            }
        ];

        for (let task of tasks) {
            await notion.pages.create({
                parent: {
                    database_id: tasksDb.id
                },
                properties: {
                    Title: {
                        title: [
                            {
                                text: {
                                    content: task.title
                                }
                            }
                        ]
                    },
                    Description: {
                        rich_text: [
                            {
                                text: {
                                    content: task.description
                                }
                            }
                        ]
                    },
                    Section: {
                        select: {
                            name: task.section
                        }
                    },
                    Completed: {
                        checkbox: false
                    },
                    Priority: {
                        select: {
                            name: task.priority
                        }
                    },
                    Status: {
                        select: {
                            name: "To Do"
                        }
                    }
                }
            });

            console.log(`Created tasks`);
        }

        console.log("Sample data creation complete.");
    } catch (error) {
        console.error("Error creating sample data:", error);
    }
}

// Run the setup
setupNotionDatabases().then(() => {
    return createSampleData();
}).then(() => {
    console.log("Setup complete!");
    process.exit(0);
}).catch(error => {
    console.error("Setup failed:", error);
    process.exit(1);
});
