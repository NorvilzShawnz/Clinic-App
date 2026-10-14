# Clinic App

A skeleton application for doctor offices built in C#. This application provides basic CRUD functionality for managing Patients, Physicians, and Appointments.

> **Web version:** a separate web implementation is deployed at https://clinicskeleton.netlify.app. It does not use the C# code: the UI is a single vanilla HTML/JS page (`public/index.html`), the API is TypeScript Netlify Functions (`netlify/functions/`), and data is stored in Netlify Database (Postgres) via Drizzle ORM (`db/`). It is a **public demo with no authentication** — use fictional data only. Full SSNs are accepted on write but the API only ever returns the last four digits. Run it locally with `npm install` and `npm run dev`.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)

## About

The Clinic App is a starting point for building applications used in a healthcare setting. It is constructed using Visual Studio Code (or Visual Studio) and C#. The project is designed to be extended and customized for specific needs in a clinical environment.

## Features

- **CRUD Operations**: Manage Patients, Physicians, and Appointments.
- **Modular Design**: Organized into separate projects (e.g., `App.Clinic` and `Library.Clinic`) for easy maintenance and scalability.

## Prerequisites

- **.NET Framework / .NET Core SDK**: Ensure you have the required version installed on your machine.
- **IDE**: Visual Studio or Visual Studio Code is recommended.
  - For Visual Studio Code, make sure the C# extension is installed.
- **Git**: To clone the repository (alternatively, you can download the ZIP archive).

## Installation

1. **Clone the Repository**

   Open your terminal or command prompt and run:
   ```bash
   git clone https://github.com/NorvilzShawnz/Clinic-App.git

## Running the Application

### Using Visual Studio

1. Open the solution file `Fall2024_Example_Windows.sln`.
2. Set the startup project (typically the `App.Clinic` project).
3. Build the solution (via **Build > Build Solution**).
4. Run the project (via **Debug > Start Debugging** or press `F5`).

### Using Visual Studio Code and the .NET CLI

1. Open the repository folder in Visual Studio Code.
2. Open an integrated terminal.
3. Navigate to the project directory you want to run (for example, `App.Clinic`):
   ```bash
   cd App.Clinic
4. Restore dependencies:
   ````bash
   dotnet restore
5. Build the project:
   ````bash
   dotnet build
6. Run the application:
   ````bash
   dotnet run
