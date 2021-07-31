FROM golang:1 AS builder

COPY . /src
COPY static /target/static
RUN CGO_ENABLED=0 GOOS=linux go install -i -a -ldflags '-extldflags "-static"' /src/...
RUN cp -r /go/bin /target

FROM scratch
COPY --from=builder /target /
ENTRYPOINT [ "/bin/vail" ]
