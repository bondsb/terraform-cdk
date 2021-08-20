import {
  TerraformResource,
  TerraformStack,
  App,
  Testing,
  TerraformOutput,
} from "cdktf/lib";
import { TerraformModule } from "cdktf/lib/terraform-module";
import { Node } from "constructs";
import { TestProvider } from "./helper";

test("stack synthesis merges all elements into a single output", () => {
  const app = Testing.stubVersion(
    Testing.enableFutureFlags(new App({ stackTraces: false }))
  );
  const stack = new TerraformStack(app, "MyStack");

  new TestProvider(stack, "test-provider", {
    accessKey: "foo",
    type: "aws",
  });

  new MyResource(stack, "Resource1", {
    terraformResourceType: "aws_bucket",
  });

  const overrideResource = new MyResource(stack, "Resource2", {
    terraformResourceType: "aws_topic",
  });
  overrideResource.addOverride("//", "this is a comment");
  overrideResource.addOverride("prop2", undefined);
  overrideResource.addOverride("prop3.name", "test");
  overrideResource.addOverride("provisioner", [
    {
      "local-exec": {
        command: "echo 'Hello World' >example.txt",
      },
    },
  ]);

  const eks = new MyModule(stack, "EksModule", {
    source: "terraform-aws-modules/eks/aws",
    version: "7.0.1",
  });

  new TerraformOutput(stack, "eks_version", {
    value: eks.version,
  });

  stack.addOverride("terraform.backend", {
    remote: {
      organization: "test",
      workspaces: {
        name: "test",
      },
    },
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("stack synthesis no flags", () => {
  const app = Testing.stubVersion(new App({ stackTraces: false }));
  const stack = new TerraformStack(app, "MyStack");

  new TestProvider(stack, "test-provider", {
    accessKey: "foo",
    type: "aws",
  });

  new MyResource(stack, "Resource1", {
    terraformResourceType: "aws_bucket",
  });

  const eks = new MyModule(stack, "EksModule", {
    source: "terraform-aws-modules/eks/aws",
    version: "7.0.1",
  });

  new TerraformOutput(stack, "eks_version", {
    value: eks.version,
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("stack validation returns error when provider is missing", () => {
  const app = Testing.stubVersion(new App({ stackTraces: false }));
  const stack = new TerraformStack(app, "MyStack");

  new MyResource(stack, "Resource1", {
    terraformResourceType: "aws_bucket",
    terraformGeneratorMetadata: {
      providerName: "test-provider",
    },
  });

  const errors = Node.of(stack).validate();

  expect(errors).toEqual([
    expect.objectContaining({
      message: `Found resources without a matching povider. Please make sure to add the following providers to your stack: test-provider`,
      source: stack,
    }),
  ]);
});

test("stack validation returns no error when provider is not set", () => {
  const app = Testing.stubVersion(new App({ stackTraces: false }));
  const stack = new TerraformStack(app, "MyStack");

  new MyResource(stack, "Resource1", {
    terraformResourceType: "aws_bucket",
  });

  const errors = Node.of(stack).validate();
  expect(errors).toEqual([]);
});

class MyModule extends TerraformModule {
  protected synthesizeAttributes() {
    return {
      cluster_name: "my_cluster_name",
    };
  }
}

class MyResource extends TerraformResource {
  protected synthesizeAttributes(): { [name: string]: any } {
    return {
      foo: this.friendlyUniqueId,
      prop1: "bar1",
      prop2: 1234,
      prop3: {
        name: "should be overwritten in resource 2",
        value: 5678,
      },
    };
  }
}
