# MediaStream - Personal Media Server & PWA

A modern, responsive, and Progressive Web Application (PWA) for managing files and streaming videos from your server. Built with Next.js, Shadcn UI, and Tailwind CSS.

## Features

- **File Browser**: Navigate your server's mapped directory.
- **Video Streaming**: Stream MP4, WebM, and other supported video formats directly in the browser (Video Player with theater mode).
- **File Upload**: Upload files to any directory.
- **PWA Support**: Installable on mobile and desktop devices.
- **Dark Mode**: Sleek black and white aesthetic.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configuration**:
    The application serves files from the `media` directory in the project root by default.
    You can create this directory and add your files:
    ```bash
    mkdir media
    # Copy your movies/files here
    ```

3.  **Run the Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser.

4.  **Build for Production**:
    ```bash
    npm run build
    npm start
    ```

## Usage

- **Accessing**: Open the web interface.
- **Browse**: Click folders to navigate.
- **Watch**: Click on a video file to enter the theater mode player.
- **PWA**: On mobile (Chrome/Safari), tap "Add to Home Screen" to install as an app.

## Technologies

- Next.js 15 (App Router)
- Shadcn UI (Components)
- Tailwind CSS v4
- @ducanh2912/next-pwa (PWA)
