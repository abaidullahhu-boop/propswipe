import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLazyS3CheckQuery } from "@/store/api/apiSlice";
import { getApiErrorMessage } from "@/lib/utils";
import toast from "react-hot-toast";

/** S3 bucket CORS — needed for many browsers to stream MP4 with Range requests from a web app origin. */
const SUGGESTED_S3_CORS_JSON = `[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 3600
  }
]`;

/** Replace BUCKET with your bucket name. Upload uses PutObject; admin preview & feed need GetObject. */
const SUGGESTED_IAM_GET_OBJECT_JSON = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListingMediaReadWrite",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::BUCKET/properties/*"
    }
  ]
}`;

export default function AdminSettings() {
  const [runS3Check, { data, isFetching }] = useLazyS3CheckQuery();
  const [lastError, setLastError] = useState<string | null>(null);

  const handleTestS3 = async () => {
    setLastError(null);
    try {
      const result = await runS3Check().unwrap();
      if (result.ok) {
        if (result.anonymousGetObjectOk === false) {
          toast.error("S3 connects, but objects are not publicly readable — fix bucket policy for playback.");
        } else {
          toast.success(`S3 OK — bucket ${result.bucket} (${result.region})`);
        }
      } else {
        const msg = result.error ?? "S3 check failed";
        setLastError(msg);
        toast.error(msg);
      }
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setLastError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-4xl font-black mb-2">Settings</h1>
        <p className="text-muted-foreground">Infrastructure checks and admin tools</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Amazon S3</CardTitle>
          <CardDescription>
            Verifies <code className="text-xs">.env</code> credentials and writes a tiny test object under{" "}
            <code className="text-xs">properties/</code> (same prefix as listing videos). Listing playback uses the{" "}
            <code className="text-xs">videoUrl</code> stored in the database — typically your S3 or CDN URL after upload.
            Public read on objects is required; for in-app HTML5 playback you also need{" "}
            <strong className="font-medium">bucket CORS</strong> (see below).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
            <p className="font-medium">S3 CORS (for video playback in the browser)</p>
            <p className="text-muted-foreground text-xs">
              AWS Console → S3 → your bucket → Permissions → Cross-origin resource sharing (CORS) → Edit. Paste JSON
              like this (tighten <code className="text-xs">AllowedOrigins</code> to your site URL in production):
            </p>
            <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto border" data-testid="pre-s3-cors">
              {SUGGESTED_S3_CORS_JSON}
            </pre>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
            <p className="font-medium">IAM: GetObject (admin preview + tooling)</p>
            <p className="text-muted-foreground text-xs">
              The upload user must be allowed to <strong className="font-medium text-foreground">read</strong> objects
              it writes. If admin preview URLs like <code className="text-xs">/api/admin/s3-media</code> fail while
              upload still works, your IAM policy likely has only <code className="text-xs">s3:PutObject</code>. Attach a
              policy that includes <code className="text-xs">s3:GetObject</code> on{" "}
              <code className="text-xs">arn:aws:s3:::YOUR_BUCKET/properties/*</code>.
            </p>
            <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto border" data-testid="pre-s3-iam">
              {SUGGESTED_IAM_GET_OBJECT_JSON}
            </pre>
          </div>
          <Button
            type="button"
            onClick={handleTestS3}
            disabled={isFetching}
            data-testid="button-s3-check"
          >
            {isFetching ? "Testing…" : "Test S3 connection"}
          </Button>
          {lastError && (
            <p className="text-sm text-destructive" data-testid="text-s3-error">
              {lastError}
            </p>
          )}
          {data?.ok === true && data.anonymousGetObjectOk === false && (
            <div
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm space-y-2"
              data-testid="s3-public-read-warning"
            >
              <p className="font-medium text-amber-950 dark:text-amber-100">
                Browser playback needs anonymous HTTPS access to objects under{" "}
                <code className="text-xs">properties/*</code>. The health-check URL returned HTTP{" "}
                {data.anonymousHeadStatus ?? "error"} without credentials (same as your video URLs in the app).
              </p>
              <p className="text-muted-foreground">
                In AWS: S3 → your bucket → Permissions → turn off &quot;Block all public access&quot; only as far as
                needed (often: allow bucket policies that grant public access) → Bucket policy → paste the JSON below.
              </p>
              {data.suggestedBucketPolicy && (
                <pre className="text-xs bg-background/80 p-3 rounded-md overflow-x-auto border">
                  {data.suggestedBucketPolicy}
                </pre>
              )}
            </div>
          )}
          {data && (
            <pre
              className="text-xs bg-muted p-4 rounded-lg overflow-x-auto"
              data-testid="pre-s3-result"
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
