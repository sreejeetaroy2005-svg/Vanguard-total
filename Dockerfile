# ---------- Stage 1: Build ----------
FROM maven:3.9.9-eclipse-temurin-21 AS builder

# Set working directory inside container
WORKDIR /app

# Copy only the Maven files first (to leverage caching)
COPY backend/server/pom.xml ./backend/server/
COPY backend/server/src ./backend/server/src

# Build the backend (skip tests for speed)
RUN cd backend/server && mvn clean package -DskipTests

# ---------- Stage 2: Runtime ----------
FROM eclipse-temurin:21-jdk-alpine

# Create a non‑root user (good practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app

# Copy the built JAR from the builder stage
COPY --from=builder /app/backend/server/target/*.jar app.jar

# Expose the port Spring Boot listens on
EXPOSE 8080

# Run the application
ENTRYPOINT ["java","-jar","/app/app.jar"]
