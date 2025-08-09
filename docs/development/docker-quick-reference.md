# Docker Quick Reference

Quick reference guide for Docker usage in the Divemap project.

## 🐳 Dockerfile Types

| Dockerfile | Purpose | Size | Use Case |
|------------|---------|------|----------|
| `frontend/Dockerfile` | Production | 144MB | Production deployment |
| `frontend/Dockerfile.dev` | Development | ~200MB | Development & testing |

## 🚀 Quick Commands

### Production Build
```bash
cd frontend
docker build -t divemap_frontend_prod .
docker run -p 8080:8080 divemap_frontend_prod
```

### Development Build
```bash
cd frontend
docker build -f Dockerfile.dev -t divemap_frontend_dev .
docker run -p 3000:3000 divemap_frontend_dev
```

### Testing
```bash
# Run tests in development container
docker run divemap_frontend_dev npm run test:frontend
docker run divemap_frontend_dev npm run test:validation
docker run divemap_frontend_dev npm run test:e2e
```

## 📦 Dependency Management

### Production Dependencies
- React, React DOM, React Router
- React Query, Axios
- OpenLayers, Tailwind CSS
- Lucide React icons

### Development Dependencies
- Puppeteer (testing)
- Testing libraries

## 🔧 Key Differences

| Feature | Production | Development |
|---------|------------|-------------|
| **Dependencies** | Production only | All dependencies |
| **Testing** | ❌ No | ✅ Full suite |
| **Size** | 144MB | ~200MB |
| **Security** | ✅ Optimized | ⚠️ Dev tools |
| **Hot Reload** | ❌ No | ✅ Yes |

## 🐛 Troubleshooting

### Common Issues

1. **Tests failing in production**
   ```bash
   # Use development Dockerfile for testing
   docker build -f Dockerfile.dev -t divemap_frontend_test .
   docker run divemap_frontend_test npm run test:frontend
   ```

2. **Large image size**
   ```bash
   # Use production Dockerfile
   docker build -t divemap_frontend_prod .
   ```

3. **Missing dependencies**
   ```bash
   # Check package.json structure
   cat package.json | grep -A 10 "dependencies"
   cat package.json | grep -A 10 "devDependencies"
   ```

## 📊 Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Image Size** | 797MB | 144MB | 82% reduction |
| **Build Time** | Slower | Faster | Optimized |
| **Security** | ⚠️ Dev tools | ✅ Clean | Enhanced |

## 🔗 Related Documentation

- [Full Docker Guide](./docker.md)
- [Development Overview](./README.md)
- [Testing Strategy](./testing.md)

---

**💡 Tip**: Use `Dockerfile.dev` for development and testing, `Dockerfile` for production deployment.