FROM golang:1 AS builder

COPY . /src
COPY static /target/static
WORKDIR /src
RUN CGO_ENABLED=0 GOOS=linux go install -a -ldflags '-extldflags "-static"' ./...
RUN cp -r /go/bin /target

FROM scratch
COPY --from=builder /target /
ENTRYPOINT [ "/bin/vail" ]
